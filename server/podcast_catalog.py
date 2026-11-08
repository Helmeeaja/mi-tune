import argparse
import datetime
import html
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from urllib.parse import urlparse
import requests
from ytmusicapi import YTMusic

VIDEO = re.compile(r'^[A-Za-z0-9_-]{11}$')
CHANNEL = re.compile(r'^UC[A-Za-z0-9_-]{22}$')
SHOW = re.compile(r'^MPSP[A-Za-z0-9_-]{10,124}$')
ARDHIANZY = 'UCd3PgaVcVCgfT_W_i78n0zg'
IMAGE_HOSTS = {'i.ytimg.com', 'lh3.googleusercontent.com', 'yt3.googleusercontent.com', 'yt3.ggpht.com'}


class PublicSession(requests.Session):
    def request(self, *args, **kwargs):
        kwargs.setdefault('timeout', (8, 22))
        return super().request(*args, **kwargs)


def duration(value):
    if isinstance(value, (int, float)):
        return int(value) if 0 < value <= 28800 else None
    if not isinstance(value, str):
        return None
    if re.fullmatch(r'\d+(?::\d{1,2}){1,2}', value):
        result = 0
        for part in value.split(':'):
            result = result * 60 + int(part)
        return result if 0 < result <= 28800 else None
    result = sum(int(count) * (3600 if unit.startswith(('h', 'hour')) else 60 if unit.startswith(('m', 'min')) else 1) for count, unit in re.findall(r'(\d+)\s*(hr|hour|min|minute|sec|second)s?', value, re.I))
    return result if 0 < result <= 28800 else None


def image(values):
    for item in sorted(values or [], key=lambda item: (item.get('width') or 0) * (item.get('height') or 0), reverse=True):
        value = item.get('url', '')
        parsed = urlparse(value)
        if parsed.scheme == 'https' and parsed.hostname in IMAGE_HOSTS and not parsed.username and not parsed.password and parsed.port is None:
            return value
    return ''


def published(value):
    if not isinstance(value, str):
        return None
    try:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:T.*)?', value):
            date = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
        elif re.fullmatch(r'[A-Za-z]{3,9} \d{1,2}, \d{4}', value):
            date = datetime.datetime.strptime(value, '%b %d, %Y') if len(value.split()[0]) == 3 else datetime.datetime.strptime(value, '%B %d, %Y')
        else:
            return None
        if date.tzinfo is None:
            date = date.replace(tzinfo=datetime.timezone.utc)
        if date > datetime.datetime.now(datetime.timezone.utc):
            return None
        return date.isoformat().replace('+00:00', 'Z')
    except ValueError:
        return None


def song_details(music, video_id):
    data = music.get_song(video_id)
    details = data.get('videoDetails', {})
    if details.get('videoId') != video_id or not CHANNEL.fullmatch(details.get('channelId', '')):
        raise ValueError('Episode identity does not match the source')
    return details, data.get('microformat', {}).get('playerMicroformatRenderer', data.get('microformat', {}).get('microformatDataRenderer', {}))


def channel_dates(session, channel_id):
    if not CHANNEL.fullmatch(channel_id):
        return {}
    try:
        response = session.get(f'https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}', allow_redirects=False)
        if response.status_code != 200 or len(response.content) > 1048576:
            return {}
        root = ET.fromstring(response.content)
        namespaces = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
        result = {}
        for entry in root.findall('a:entry', namespaces):
            video_id = entry.findtext('yt:videoId', namespaces=namespaces)
            date = published(entry.findtext('a:published', namespaces=namespaces))
            if video_id and VIDEO.fullmatch(video_id) and date:
                result[video_id] = date
        return result
    except Exception:
        return {}


def normalize_episode(raw, creator, show_id, show_title, dates=None, kind='podcast'):
    video_id = raw.get('videoId') or raw.get('id')
    length = duration(raw.get('duration_seconds') or raw.get('duration'))
    if not isinstance(video_id, str) or not VIDEO.fullmatch(video_id) or not raw.get('title') or not length or raw.get('live') or raw.get('isAvailable') is False:
        return None
    if kind == 'podcast' and raw.get('videoType') not in {None, 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE'}:
        return None
    date = (dates or {}).get(video_id) or published(raw.get('publishedAt') or raw.get('publishDate') or raw.get('date'))
    result = {'id': f'podcast:yt:{video_id}', 'videoId': video_id, 'type': 'episode', 'contentKind': 'audio-essay' if kind == 'audio-essay' else 'podcast', 'source': 'youtube-creator-audio' if kind == 'audio-essay' else 'youtube-music-podcast', 'musicType': raw.get('videoType') or ('MUSIC_VIDEO_TYPE_UGC' if kind == 'audio-essay' else 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE'), 'title': str(raw['title'])[:600], 'artist': creator['name'], 'artists': [creator['name']], 'creatorId': creator['id'], 'showId': show_id, 'album': show_title, 'duration': length, 'thumbnail': image(raw.get('thumbnails')), 'description': str(raw.get('description') or '')[:20000], 'sourceUrl': f'https://www.youtube.com/watch?v={video_id}'}
    if date:
        result['publishedAt'] = date
    return result


def creator_summary(creator_id, name, thumbnails=None, description=''):
    if not CHANNEL.fullmatch(creator_id or '') or not isinstance(name, str) or not name.strip():
        raise ValueError('Creator identity is missing')
    return {'id': creator_id, 'name': name.strip(), 'thumbnail': image(thumbnails), 'description': str(description or '')[:20000], 'shows': [], 'episodes': [], 'source': 'youtube-music-podcast'}


def enrich_latest(music, episodes, creator):
    if not episodes:
        return
    first = episodes[0]
    try:
        details, micro = song_details(music, first['videoId'])
        if details['channelId'] != creator['id']:
            return
        exact = duration(int(details.get('lengthSeconds', 0)))
        if exact:
            first['duration'] = exact
        date = published(micro.get('publishDate') or micro.get('uploadDate'))
        if date:
            first['publishedAt'] = date
    except Exception:
        pass
    dates = [episode['publishedAt'] for episode in episodes if episode.get('publishedAt')]
    if dates:
        creator['latestEpisodeAt'] = max(dates)
        latest = datetime.datetime.fromisoformat(creator['latestEpisodeAt'].replace('Z', '+00:00'))
        creator['active'] = datetime.datetime.now(datetime.timezone.utc) - latest <= datetime.timedelta(days=90)


def get_show(music, session, show_id, limit=30):
    if not SHOW.fullmatch(show_id):
        raise ValueError('Podcast identity is invalid')
    raw = music.get_podcast(show_id, limit=limit)
    author = raw.get('author', {})
    creator = creator_summary(author.get('id'), author.get('name'))
    dates = channel_dates(session, creator['id'])
    episodes = [normalize_episode(item, creator, show_id, raw.get('title', ''), dates) for item in raw.get('episodes', [])]
    episodes = [item for item in episodes if item]
    enrich_latest(music, episodes, creator)
    show = {'id': show_id, 'title': raw.get('title', ''), 'creatorId': creator['id'], 'creatorName': creator['name'], 'thumbnail': image(raw.get('thumbnails')), 'description': str(raw.get('description') or '')[:20000], 'source': 'youtube-music-podcast', 'episodes': episodes, 'sourceUrl': f'https://music.youtube.com/browse/{show_id}'}
    creator['shows'] = [show]
    creator['episodes'] = episodes
    return creator, show, episodes


def yt_json(url, flat=False, audio=False):
    command = ['yt-dlp', '--ignore-config', '--no-warnings', '--skip-download', '--dump-single-json', '--socket-timeout', '18', '--retries', '1', '--extractor-retries', '1', '--remote-components', 'ejs:github']
    if flat:
        command += ['--flat-playlist', '--playlist-end', '30']
    else:
        command += ['--no-playlist']
    if audio:
        command += ['-f', '140/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio']
    result = subprocess.run(command + ['--', url], capture_output=True, text=True, timeout=75, check=True)
    if len(result.stdout) > 8388608:
        raise ValueError('Podcast response is too large')
    return json.loads(result.stdout)


def ardhianzy(music, session):
    raw = yt_json(f'https://www.youtube.com/channel/{ARDHIANZY}/videos', flat=True)
    if raw.get('channel_id') != ARDHIANZY or raw.get('id') != ARDHIANZY:
        raise ValueError('Creator channel identity does not match')
    avatars = [item for item in raw.get('thumbnails', []) if 'avatar' in str(item.get('id', '')) or item.get('width') == item.get('height')]
    creator = creator_summary(ARDHIANZY, raw.get('channel'), avatars, raw.get('description'))
    creator['source'] = 'youtube-creator-audio'
    creator['contentKind'] = 'audio-essay'
    dates = channel_dates(session, ARDHIANZY)
    show_id = f'channel:{ARDHIANZY}'
    episodes = [normalize_episode(item, creator, show_id, raw.get('channel'), dates, 'audio-essay') for item in raw.get('entries', [])]
    episodes = [item for item in episodes if item]
    enrich_latest(music, episodes, creator)
    show = {'id': show_id, 'title': creator['name'], 'creatorId': creator['id'], 'creatorName': creator['name'], 'source': 'youtube-creator-audio', 'contentKind': 'audio-essay', 'episodes': episodes, 'sourceUrl': f'https://www.youtube.com/channel/{ARDHIANZY}/videos'}
    creator['shows'] = [show]
    creator['episodes'] = episodes
    return creator, show, episodes


profiles = {}


def enrich_creator(creator):
    creator_id = creator['id']
    if creator.get('thumbnail') and creator.get('description'):
        return
    if creator_id in profiles:
        creator.update(profiles[creator_id])
        return
    try:
        raw = yt_json(f'https://www.youtube.com/channel/{creator_id}/videos', flat=True)
        if raw.get('channel_id') != creator_id or raw.get('id') != creator_id:
            return
        avatars = [item for item in raw.get('thumbnails', []) if 'avatar' in str(item.get('id', '')) or item.get('width') == item.get('height')]
        value = {'thumbnail': image(avatars) or creator.get('thumbnail', ''), 'description': str(raw.get('description') or creator.get('description') or '')[:20000]}
        creator.update(value)
        profiles[creator_id] = value
    except Exception:
        pass


def aggregate(creators, shows, episodes, warnings=None):
    by_creator = {}
    for creator in creators:
        target = by_creator.setdefault(creator['id'], dict(creator))
        target['shows'] = list({show['id']: show for show in target.get('shows', []) + creator.get('shows', [])}.values())
        target['episodes'] = list({episode['id']: episode for episode in target.get('episodes', []) + creator.get('episodes', [])}.values())
        if creator.get('latestEpisodeAt', '') > target.get('latestEpisodeAt', ''):
            target['latestEpisodeAt'] = creator['latestEpisodeAt']
            target['active'] = creator.get('active', False)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(enrich_creator, by_creator.values()))
    return {'creators': list(by_creator.values()), 'shows': list({show['id']: show for show in shows}.values()), 'episodes': list({episode['id']: episode for episode in episodes}.values()), 'source': 'YouTube Music podcasts & creator audio', 'warnings': warnings or []}


def search_catalog(music, session, query, discover=False):
    creators, shows, episodes, warnings = [], [], [], []
    if discover or query.casefold() == 'ardhianzy':
        try:
            creator, show, values = ardhianzy(music, session)
            creators.append(creator)
            shows.append(show)
            episodes += values
        except Exception:
            warnings.append('Esai audio Ardhianzy belum bisa dimuat. Podcast lainnya tetap bisa dicoba.')
    queries = ['podcast Indonesia', 'podcast cerita', 'podcast komedi', 'Makna Talks', 'Endgame'] if discover else [query]
    seen = set()
    for term in queries:
        try:
            results = music.search(term, filter='podcasts', limit=6)
        except Exception:
            warnings.append('Sebagian podcast belum bisa dimuat. Coba lagi nanti.')
            continue
        for item in results[:2 if discover else 4]:
            show_id = item.get('browseId')
            if not isinstance(show_id, str) or not SHOW.fullmatch(show_id) or show_id in seen:
                continue
            seen.add(show_id)
            try:
                creator, show, values = get_show(music, session, show_id, limit=25)
                creators.append(creator)
                shows.append(show)
                episodes += values
            except Exception:
                warnings.append('Satu podcast belum bisa dimuat dari sumbernya.')
    if not discover:
        try:
            found = music.search(query, filter='episodes', limit=6)
            for item in found[:5]:
                if item.get('videoType') != 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE' or not VIDEO.fullmatch(item.get('videoId', '')):
                    continue
                show_id = item.get('podcast', {}).get('id')
                if not SHOW.fullmatch(show_id or ''):
                    continue
                try:
                    creator, show, values = get_show(music, session, show_id, limit=1)
                    raw = music.get_episode(item['videoId'])
                    raw.update({'videoId': item['videoId'], 'videoType': item['videoType']})
                    episode = normalize_episode(raw, creator, show_id, show['title'], {item['videoId']: published(item.get('date'))} if published(item.get('date')) else {})
                    if episode:
                        episodes.append(episode)
                        creators.append(creator)
                        shows.append(show)
                except Exception:
                    continue
        except Exception:
            warnings.append('Sebagian episode belum bisa dimuat. Hasil lain tetap tersedia.')
    return aggregate(creators, shows, episodes, list(dict.fromkeys(warnings)))


def get_creator(music, session, creator_id):
    if not CHANNEL.fullmatch(creator_id):
        raise ValueError('Creator identity is invalid')
    if creator_id == ARDHIANZY:
        return ardhianzy(music, session)[0]
    user = music.get_user(creator_id)
    name = user.get('name')
    if not name:
        raise ValueError('Creator profile is unavailable')
    result = search_catalog(music, session, name)
    for creator in result['creators']:
        if creator['id'] == creator_id:
            return creator
    raise ValueError('Creator podcasts are unavailable')


def get_episode(music, session, video_id, known=None):
    if not VIDEO.fullmatch(video_id):
        raise ValueError('Episode identity is invalid')
    if known and known.get('contentKind') == 'audio-essay':
        details, micro = song_details(music, video_id)
        if details['channelId'] != ARDHIANZY or known.get('creatorId') != ARDHIANZY:
            raise ValueError('Creator audio identity does not match')
        result = dict(known)
        result['duration'] = duration(int(details.get('lengthSeconds', 0))) or result['duration']
        result['description'] = str(details.get('shortDescription') or known.get('description') or '')[:20000]
        date = published(micro.get('publishDate') or micro.get('uploadDate'))
        if date:
            result['publishedAt'] = date
        return result
    raw = music.get_episode(video_id)
    show_id = raw.get('playlistId')
    if not SHOW.fullmatch(show_id or ''):
        raise ValueError('This video is not a podcast episode')
    creator, show, values = get_show(music, session, show_id, limit=1)
    raw.update({'videoId': video_id, 'videoType': 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE'})
    result = normalize_episode(raw, creator, show_id, show['title'])
    if not result:
        raise ValueError('Episode details are incomplete')
    try:
        details, micro = song_details(music, video_id)
        result['duration'] = duration(int(details.get('lengthSeconds', 0))) or result['duration']
        result['description'] = str(details.get('shortDescription') or result['description'])[:20000]
        date = published(micro.get('publishDate') or micro.get('uploadDate'))
        if date:
            result['publishedAt'] = date
    except Exception:
        pass
    return result


def audio_source(music, session, video_id, known):
    if not VIDEO.fullmatch(video_id):
        raise ValueError('Episode identity is invalid')
    valid_source = isinstance(known, dict) and (known.get('source') == 'youtube-music-podcast' and known.get('musicType') == 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE' or known.get('source') == 'youtube-creator-audio' and known.get('contentKind') == 'audio-essay' and known.get('creatorId') == ARDHIANZY)
    valid_known = valid_source and known.get('id') == f'podcast:yt:{video_id}' and known.get('type') == 'episode' and CHANNEL.fullmatch(known.get('creatorId', '')) and duration(known.get('duration'))
    episode = dict(known) if valid_known else get_episode(music, session, video_id, known)
    raw = yt_json(f'https://www.youtube.com/watch?v={video_id}', audio=True)
    if raw.get('id') != video_id or raw.get('is_live') or raw.get('channel_id') != episode['creatorId']:
        raise ValueError('Podcast audio identity does not match')
    length = duration(raw.get('duration'))
    if not length:
        raise ValueError('Podcast audio length is invalid')
    episode['duration'] = length
    candidates = raw.get('requested_downloads') or [raw]
    for item in candidates:
        url = item.get('url')
        parsed = urlparse(url or '')
        if parsed.scheme == 'https' and parsed.hostname and parsed.hostname.endswith('.googlevideo.com') and parsed.path == '/videoplayback' and not parsed.username and not parsed.password and parsed.port is None and item.get('vcodec') == 'none' and item.get('ext') in {'m4a', 'webm'}:
            return {'url': url, 'contentType': 'audio/mp4' if item['ext'] == 'm4a' else 'audio/webm', 'duration': length, 'episode': episode}
    raise ValueError('A direct podcast audio stream is unavailable')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['discover', 'search', 'creator', 'episode', 'source'])
    parser.add_argument('value', nargs='?', default='')
    args = parser.parse_args()
    session = PublicSession()
    music = YTMusic(language='en', location='ID', requests_session=session)
    if args.mode == 'discover':
        result = search_catalog(music, session, '', True)
    elif args.mode == 'search':
        if not 2 <= len(args.value) <= 120 or re.search(r'https?://|www\.', args.value, re.I):
            raise ValueError('Search a podcast title, creator, or topic, not a URL')
        result = search_catalog(music, session, args.value)
    elif args.mode == 'creator':
        result = get_creator(music, session, args.value)
    else:
        raw = sys.stdin.read(50000)
        known = json.loads(raw) if raw.strip() else None
        result = audio_source(music, session, args.value, known) if args.mode == 'source' else get_episode(music, session, args.value, known)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'error': 'Podcast belum bisa dimuat dari sumbernya. Coba lagi nanti.'}, ensure_ascii=False))
        sys.exit(1)
