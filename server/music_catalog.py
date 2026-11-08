import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor

from music_search import TimeoutSession
from ytmusicapi import YTMusic

ARTIST_ID = re.compile(r"UC[A-Za-z0-9_-]{22}")
ALBUM_ID = re.compile(r"MPRE[A-Za-z0-9_-]{4,124}")


def image(value):
    images = value.get('thumbnails') or []
    valid = [item for item in images if isinstance(item, dict) and isinstance(item.get('url'), str)]
    return max(valid, key=lambda item: item.get('width', 0)).get('url', '') if valid else ''


def artist_refs(values):
    result = []
    for value in values or []:
        if not isinstance(value, dict):
            continue
        identity = value.get('id') or value.get('browseId') or ''
        name = value.get('name') or value.get('artist') or value.get('title') or ''
        if ARTIST_ID.fullmatch(identity) and isinstance(name, str) and name.strip() and not any(item['id'] == identity for item in result):
            result.append({'id': identity, 'name': name.strip()})
    return result


def artist_summary(value):
    identity = value.get('id') or value.get('browseId') or value.get('channelId') or ''
    name = value.get('artist') or value.get('name') or value.get('title')
    if not ARTIST_ID.fullmatch(identity) or not isinstance(name, str) or not name.strip():
        return None
    return {'id': identity, 'name': name.strip(), 'thumbnail': image(value), 'source': 'youtube-music'}


def album_summary(value, artists=None, kind='Album'):
    identity = value.get('browseId') or value.get('id') or ''
    if not ALBUM_ID.fullmatch(identity) or not isinstance(value.get('title'), str) or not value['title'].strip():
        return None
    return {'id': identity, 'title': value['title'].strip(), 'thumbnail': image(value), 'year': value.get('year'), 'type': value.get('type') or kind, 'artists': artist_refs(value.get('artists')) or artists or []}


def song(value, fallback_artists=None, album=None, position=None):
    artists = value.get('artists') or fallback_artists or []
    names = [item.get('name', '').strip() if isinstance(item, dict) else item for item in artists]
    names = [name for name in names if isinstance(name, str) and name]
    source_album = value.get('album')
    album_name = source_album.get('name', '') if isinstance(source_album, dict) else source_album or ''
    album_id = source_album.get('id') if isinstance(source_album, dict) else None
    if album:
        album_id = album['id']
        album_name = album['title']
    duration = value.get('duration_seconds')
    if not isinstance(duration, (int, float)):
        parts = str(value.get('duration', '')).split(':')
        duration = sum(int(part) * 60 ** index for index, part in enumerate(reversed(parts))) if parts and all(part.isdigit() for part in parts) else None
    result = {'resultType': 'song', 'videoId': value.get('videoId'), 'videoType': value.get('videoType'), 'title': value.get('title'), 'artists': names, 'artistRefs': artist_refs(artists), 'album': album_name, 'albumId': album_id, 'duration': duration, 'thumbnail': image(value) or (album or {}).get('thumbnail', ''), 'position': position, 'available': value.get('isAvailable', True)}
    if album_id and ALBUM_ID.fullmatch(album_id):
        result['catalogueType'] = 'album-track'
    return result


def unique(values):
    result = []
    seen = set()
    for value in values:
        if value and value['id'] not in seen:
            result.append(value)
            seen.add(value['id'])
    return result


def client():
    return YTMusic(requests_session=TimeoutSession(), language='en', location='ID')


def search_catalogue(query):
    if not isinstance(query, str) or not 2 <= len(query.strip()) <= 160 or re.search(r'https?://|www\.', query, re.I):
        raise ValueError('Pencarian harus 2–160 karakter, bukan URL.')
    def fetch(kind):
        return client().search(query, filter=kind, limit=8, ignore_spelling=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        tasks = {kind: pool.submit(fetch, kind) for kind in ['artists', 'albums']}
        results = {}
        warnings = []
        for kind, task in tasks.items():
            try:
                results[kind] = task.result()
            except Exception:
                results[kind] = []
                warnings.append({'code': f'{kind.upper()}_SEARCH_UNAVAILABLE', 'message': 'Sebagian hasil artis atau album belum dapat dimuat. Lagu yang tersedia tetap bisa diputar.'})
    if len(warnings) == len(tasks):
        raise RuntimeError('Katalog artis dan album tidak tersedia saat ini.')
    return {'artists': unique(artist_summary(value) for value in results['artists']), 'albums': unique(album_summary(value) for value in results['albums']), 'warnings': warnings}


def fetch_artist(identity, summary_only=False):
    if not ARTIST_ID.fullmatch(identity):
        raise ValueError('Identitas artis tidak valid.')
    api = client()
    raw = api.get_artist(identity)
    summary = artist_summary({**raw, 'id': identity})
    if not summary:
        raise RuntimeError('Profil artis tidak tersedia dari sumber.')
    if summary_only:
        return summary
    refs = [{'id': identity, 'name': summary['name']}]
    warnings = []
    def releases(key, kind):
        part = raw.get(key) or {}
        values = part.get('results') or []
        if part.get('browseId') and part.get('params'):
            try:
                values = api.get_artist_albums(part['browseId'], part['params'], limit=None)
            except Exception:
                warnings.append({'code': 'ARTIST_RELEASES_PARTIAL', 'message': 'Sebagian rilisan belum dapat dimuat. Menampilkan rilisan yang tersedia dari sumber.'})
        return unique(album_summary(value, refs, kind) for value in values)
    albums = releases('albums', 'Album')
    singles = releases('singles', 'Single')
    source_songs = (raw.get('songs') or {}).get('results') or []
    browse = (raw.get('songs') or {}).get('browseId')
    if browse:
        try:
            source_songs = api.get_playlist(browse.removeprefix('VL'), limit=None).get('tracks') or source_songs
        except Exception:
            warnings.append({'code': 'ARTIST_SONGS_PARTIAL', 'message': 'Menampilkan lagu unggulan artis. Daftar lagu lainnya tersedia melalui album dan rilisan.'})
    related = unique(artist_summary(value) for value in (raw.get('related') or {}).get('results', []))
    return {**summary, 'description': raw.get('description') or '', 'tracks': [song(value, refs) for value in source_songs], 'albums': albums, 'singles': singles, 'related': related, 'warnings': warnings, 'albumsComplete': not any(value['code'] == 'ARTIST_RELEASES_PARTIAL' for value in warnings), 'source': 'youtube-music'}


def fetch_album(identity):
    if not ALBUM_ID.fullmatch(identity):
        raise ValueError('Identitas album tidak valid.')
    raw = client().get_album(identity)
    summary = album_summary({**raw, 'id': identity})
    if not summary:
        raise RuntimeError('Album tidak tersedia dari sumber.')
    values = raw.get('tracks') or []
    return {**summary, 'description': raw.get('description') or '', 'sourceTotal': len(values), 'tracks': [song(value, raw.get('artists'), summary, index + 1) for index, value in enumerate(values)], 'source': 'youtube-music'}


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3:
            raise ValueError('Mode dan identitas katalog diperlukan.')
        mode, value = sys.argv[1:]
        result = search_catalogue(value) if mode == 'search' else fetch_artist(value, True) if mode == 'summary' else fetch_artist(value) if mode == 'artist' else fetch_album(value) if mode == 'album' else None
        if result is None:
            raise ValueError('Mode katalog tidak valid.')
        print(json.dumps(result, ensure_ascii=False))
    except ValueError as failure:
        print(str(failure), file=sys.stderr)
        sys.exit(2)
    except Exception:
        print('Katalog artis dan album tidak tersedia saat ini. Coba lagi nanti.', file=sys.stderr)
        sys.exit(1)
