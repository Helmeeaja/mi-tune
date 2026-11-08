import json
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor

from ytmusicapi import YTMusic
from music_search import TimeoutSession


def normalized(text):
    text = unicodedata.normalize('NFKC', str(text)).casefold()
    text = re.sub(r'\([^)]*(?:official\s*(?:music\s*)?(?:video|audio)|lyric(?:s)?\s*video|visuali[sz]er)[^)]*\)', '', text)
    text = re.sub(r'\[(?:[^\]]*(?:official\s*(?:music\s*)?(?:video|audio)|lyric(?:s)?\s*video|visuali[sz]er)[^\]]*)\]', '', text)
    text = re.sub(r'\b(?:official\s*(?:music\s*)?(?:video|audio)|lyrics?\s*video|visuali[sz]er)\b', '', text)
    return re.sub(r'[^\w]+', ' ', text).strip()


def valid_audio(value):
    artists = [artist.get('name', '').strip() for artist in value.get('artists', []) if artist.get('name')]
    duration = value.get('duration_seconds')
    return value.get('videoType') == 'MUSIC_VIDEO_TYPE_ATV' and re.fullmatch(r'[A-Za-z0-9_-]{11}', value.get('videoId') or '') and artists and isinstance(duration, (int, float)) and 15 <= duration <= 1800 and isinstance(value.get('title'), str) and value['title'].strip() and value.get('isAvailable', True)


def resolve_audio(api, video):
    if valid_audio(video):
        return video
    if video.get('videoType') != 'MUSIC_VIDEO_TYPE_OMV' or not re.fullmatch(r'[A-Za-z0-9_-]{11}', video.get('videoId') or ''):
        return None
    names = {normalized(artist.get('name', '')) for artist in video.get('artists', []) if artist.get('name')}
    if not names or not video.get('title'):
        return None
    query = normalized(video['title']) + ' ' + next(iter(names))
    try:
        candidates = api.search(query, filter='songs', limit=8, ignore_spelling=True)
    except Exception:
        return None
    title = normalized(video['title'])
    for candidate in candidates:
        if not valid_audio(candidate) or normalized(candidate['title']) != title:
            continue
        candidate_names = {normalized(artist.get('name', '')) for artist in candidate.get('artists', []) if artist.get('name')}
        if not names.intersection(candidate_names):
            continue
        duration = video.get('duration_seconds')
        if isinstance(duration, (int, float)) and abs(duration - candidate['duration_seconds']) > max(30, duration * 0.15):
            continue
        return candidate
    return None


def serialize_song(value, rank, chart_video_id):
    thumbnails = sorted(value.get('thumbnails') or [], key=lambda image: image.get('width', 0), reverse=True)
    source_album = value.get('album') or {}
    return {'videoId': value['videoId'], 'resultType': 'song', 'videoType': 'MUSIC_VIDEO_TYPE_ATV', 'title': value['title'], 'artists': [artist['name'].strip() for artist in value.get('artists', []) if artist.get('name')], 'artistRefs': [{'id': artist['id'], 'name': artist['name'].strip()} for artist in value.get('artists', []) if isinstance(artist.get('id'), str) and re.fullmatch(r'UC[A-Za-z0-9_-]{22}', artist['id']) and artist.get('name')], 'album': source_album.get('name', '') if isinstance(source_album, dict) else source_album, 'albumId': source_album.get('id') if isinstance(source_album, dict) else None, 'duration': value['duration_seconds'], 'thumbnail': thumbnails[0].get('url', '') if thumbnails else '', 'chartRank': rank, 'chartVideoId': chart_video_id}


def chart_songs(api, country='ZZ'):
    if country != 'ZZ':
        raise ValueError('Trending memakai chart global, bukan chart negara tertentu.')
    charts = api.get_charts(country='ZZ')
    selected = (charts.get('countries') or {}).get('selected') or {}
    if selected.get('text') and selected['text'].casefold() != 'global':
        raise ValueError('Sumber belum mengembalikan chart global yang dapat diverifikasi.')
    choices = [value for value in charts.get('videos', []) if 'global' in value.get('title', '').casefold()]
    chart = next((value for value in choices if 'daily' in value.get('title', '').casefold()), None) or next((value for value in choices if 'top' in value.get('title', '').casefold()), None)
    if not chart or not re.fullmatch(r'[A-Za-z0-9_-]{10,128}', chart.get('playlistId', '')):
        raise ValueError('Chart musik global belum tersedia.')
    playlist = api.get_playlist(chart['playlistId'], limit=100)
    values = (playlist.get('tracks') or [])[:100]
    tracks = []
    seen = set()
    with ThreadPoolExecutor(max_workers=3) as pool:
        for start in range(0, len(values), 6):
            batch = values[start:start + 6]
            resolved = list(pool.map(lambda video: resolve_audio(api, video), batch))
            for offset, value in enumerate(resolved):
                if not value or value['videoId'] in seen:
                    continue
                tracks.append(serialize_song(value, start + offset + 1, batch[offset].get('videoId')))
                seen.add(value['videoId'])
                if len(tracks) == 20:
                    break
            if len(tracks) == 20:
                break
    if not tracks:
        raise ValueError('Chart global belum memiliki lagu audio resmi yang dapat diverifikasi.')
    count = playlist.get('trackCount')
    source_total = count if isinstance(count, int) and count >= len(values) else len(values)
    return {'tracks': tracks, 'updatedAt': int(time.time() * 1000), 'source': 'YouTube Music · ' + chart['title'] + ' (verified song audio)', 'region': 'ZZ', 'chartCountry': 'ZZ', 'chartVersion': 2, 'chartId': chart['playlistId'], 'sourceUrl': 'https://music.youtube.com/playlist?list=' + chart['playlistId'], 'sourceTotal': source_total, 'stale': False}


def get_spotify_metadata(session):
    playlist_id = '37i9dQZEVXbMDoHDwVN2tF'
    response = session.get('https://open.spotify.com/embed/playlist/' + playlist_id, timeout=20)
    response.raise_for_status()
    match = re.search(r'<script[^>]+id=[\"\']__NEXT_DATA__[\"\'][^>]*>(.*?)</script>', response.text, re.S)
    if not match:
        raise ValueError('Daftar Spotify belum bisa dibaca.')
    try:
        entity = json.loads(match.group(1))['props']['pageProps']['state']['data']['entity']
    except (KeyError, TypeError, json.JSONDecodeError) as error:
        raise ValueError('Metadata Spotify tidak valid.') from error
    if entity.get('uri') != 'spotify:playlist:' + playlist_id:
        raise ValueError('Sumber bukan daftar Spotify global yang diminta.')
    rows = entity.get('trackList')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 100:
        raise ValueError('Daftar Spotify kosong atau tidak valid.')
    entries = []
    seen = set()
    for rank, row in enumerate(rows, 1):
        uri = row.get('uri', '')
        title = row.get('title', '')
        subtitle = row.get('subtitle', '')
        duration = row.get('duration')
        if not re.fullmatch(r'spotify:track:[A-Za-z0-9]{22}', uri) or uri in seen or not isinstance(title, str) or not title.strip() or not isinstance(subtitle, str) or not subtitle.strip() or not isinstance(duration, (int, float)) or not 15000 <= duration <= 1800000:
            raise ValueError('Identitas lagu dalam daftar Spotify tidak valid.')
        seen.add(uri)
        entries.append({'title': title, 'artists': [part.strip() for part in subtitle.split(', ') if part.strip()], 'spotifyId': uri.split(':')[2], 'spotifyUri': uri, 'spotifyDuration': duration / 1000, 'chartRank': rank})
    return {'entries': entries, 'source': 'Spotify · Top 50 - Global', 'sourceUrl': 'https://open.spotify.com/playlist/' + playlist_id, 'sourceTotal': len(rows), 'chartId': playlist_id, 'chartOrigin': 'spotify', 'chartProvider': 'spotify', 'chartVersion': 3, 'region': 'ZZ', 'chartCountry': 'ZZ', 'chartDate': None, 'dateKind': 'retrieved'}


def resolve_spotify_entry(api, entry):
    try:
        candidates = api.search(entry['title'] + ' ' + ' '.join(entry['artists']), filter='songs', limit=6, ignore_spelling=True)
    except Exception:
        return None
    source_title = normalized(entry['title'])
    source_artists = {normalized(name) for name in entry['artists']}
    for value in candidates:
        duration = value.get('duration_seconds', value.get('duration'))
        value = {**value, 'duration_seconds': duration}
        if not valid_audio(value) or normalized(value['title']) != source_title:
            continue
        names = {normalized(artist.get('name', '')) if isinstance(artist, dict) else normalized(artist) for artist in value.get('artists', [])}
        if not source_artists.intersection(names) or abs(duration - entry['spotifyDuration']) > max(4, entry['spotifyDuration'] * .025):
            continue
        result = serialize_song(value, entry['chartRank'], value['videoId'])
        result.update({key: entry[key] for key in ('spotifyId', 'spotifyUri', 'spotifyDuration') if key in entry})
        result.update({'chartTitle': entry['title'], 'chartArtists': entry['artists'], 'rankingSource': 'spotify'})
        return result
    return None


def spotify_songs(api, session):
    metadata = get_spotify_metadata(session)
    tracks = []
    seen = set()
    with ThreadPoolExecutor(max_workers=3) as pool:
        entries = metadata['entries']
        for start in range(0, len(entries), 6):
            for value in pool.map(lambda entry: resolve_spotify_entry(api, entry), entries[start:start + 6]):
                if value and value['videoId'] not in seen:
                    tracks.append(value)
                    seen.add(value['videoId'])

    if not tracks:
        raise ValueError('Lagu dari daftar Spotify belum ditemukan di katalog audio Mi Tune.')
    matched = {track['spotifyId']: track for track in tracks}
    unavailable = [{**entry, 'reason': 'no-matching-recording'} for entry in metadata['entries'] if entry['spotifyId'] not in matched]
    entries = [{**entry, 'status': 'matched' if entry['spotifyId'] in matched else 'unavailable', **({'trackId': matched[entry['spotifyId']]['videoId']} if entry['spotifyId'] in matched else {})} for entry in metadata['entries']]
    if len(entries) != metadata['sourceTotal'] or len(tracks) + len(unavailable) != metadata['sourceTotal']:
        raise ValueError('Jumlah hasil chart belum cocok dengan daftar Spotify.')
    return {**{key: value for key, value in metadata.items() if key != 'entries'}, 'tracks': tracks, 'chartEntries': entries, 'unavailable': unavailable, 'matchedCount': len(tracks), 'unavailableCount': len(unavailable), 'mappingComplete': True, 'updatedAt': int(time.time() * 1000), 'stale': False, 'partial': len(tracks) < metadata['sourceTotal']}


if __name__ == '__main__':
    try:
        session = TimeoutSession()
        api = YTMusic(requests_session=session, language='en', location='ID')
        print(json.dumps(spotify_songs(api, session), ensure_ascii=False))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
    except Exception:
        print('Chart musik global sedang tidak tersedia. Coba lagi nanti.', file=sys.stderr)
        sys.exit(1)
