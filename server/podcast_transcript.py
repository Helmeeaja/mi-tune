import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from html import unescape
from urllib.parse import parse_qs, urlparse

import requests


def text(value):
    return ' '.join(re.sub(r'<[^>]+>', '', unescape(value)).split()).strip()


def timestamp(value):
    parts = value.replace(',', '.').split(':')
    if len(parts) not in (2, 3):
        raise ValueError('Invalid caption timestamp')
    result = float(parts[-1]) + int(parts[-2]) * 60
    return result + (int(parts[0]) * 3600 if len(parts) == 3 else 0)


def parse_caption(body, extension):
    values = []
    if extension == 'json3':
        data = json.loads(body)
        for event in data.get('events', []):
            start = event.get('tStartMs')
            if isinstance(start, (int, float)):
                values.append((start / 1000, ''.join(str(segment.get('utf8', '')) for segment in event.get('segs', []))))
    elif extension in {'vtt', 'srt'}:
        lines = body.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        index = 0
        while index < len(lines):
            line = lines[index].strip()
            index += 1
            if '-->' not in line:
                continue
            start = timestamp(line.split('-->', 1)[0].strip())
            words = []
            while index < len(lines) and lines[index].strip():
                words.append(lines[index].strip())
                index += 1
            values.append((start, ' '.join(words)))
    elif extension in {'srv1', 'srv2', 'srv3', 'xml', 'ttml'}:
        if '<!DOCTYPE' in body.upper() or '<!ENTITY' in body.upper():
            raise ValueError('Invalid caption XML')
        root = ET.fromstring(body)
        for node in root.iter():
            tag = node.tag.rsplit('}', 1)[-1]
            if tag == 'text' and 'start' in node.attrib:
                start = float(node.attrib['start'])
            elif tag == 'p' and 't' in node.attrib:
                start = float(node.attrib['t']) / 1000
            elif tag == 'p' and 'begin' in node.attrib:
                value = node.attrib['begin']
                start = float(value[:-1]) if value.endswith('s') else timestamp(value)
            else:
                continue
            values.append((start, ''.join(node.itertext())))
    cues = []
    total = 0
    for start, value in sorted(values, key=lambda value: value[0]):
        cleaned = text(value)
        if not cleaned or not 0 <= start <= 28860 or len(cleaned) > 4000:
            continue
        total += len(cleaned)
        if total > 800000 or len(cues) >= 10000:
            break
        if cues and cues[-1]['time'] == start:
            cues[-1]['text'] = cleaned
        else:
            cues.append({'time': start, 'text': cleaned})
    return cues


def transcript(video_id, creator_id, language):
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id) or not re.fullmatch(r'UC[A-Za-z0-9_-]{22}', creator_id) or language not in {'id', 'en'}:
        raise ValueError('Invalid podcast identity')
    deadline = time.monotonic() + 78
    command = ['yt-dlp', '--ignore-config', '--no-playlist', '--skip-download', '--dump-single-json', '--no-warnings', '--socket-timeout', '15', '--retries', '1', '--extractor-retries', '1', '--remote-components', 'ejs:github', '--', f'https://www.youtube.com/watch?v={video_id}']
    raw = subprocess.run(command, capture_output=True, text=True, timeout=60, check=True)
    if len(raw.stdout) > 8388608:
        raise ValueError('Podcast metadata is too large')
    info = json.loads(raw.stdout)
    if info.get('id') != video_id or info.get('channel_id') != creator_id or info.get('is_live'):
        raise ValueError('Podcast identity does not match')
    empty = {'episodeId': f'podcast:yt:{video_id}', 'available': False, 'cues': [], 'text': '', 'language': language}
    order = {'json3': 0, 'vtt': 1, 'srv3': 2, 'srv1': 3, 'srv2': 4, 'ttml': 5, 'srt': 6, 'xml': 7}
    attempts = 0
    offered = False
    with requests.Session() as session:
        session.trust_env = False
        session.headers.update({'User-Agent': str((info.get('http_headers') or {}).get('User-Agent') or 'Mozilla/5.0'), 'Referer': f'https://www.youtube.com/watch?v={video_id}'})
        for automatic, captions in [(False, info.get('subtitles') or {}), (True, info.get('automatic_captions') or {})]:
            languages = list(dict.fromkeys([language, info.get('language'), 'id', 'en', 'en-orig'] + [key for key in captions if key.endswith('-orig')] + list(captions)))
            for selected in languages:
                if not isinstance(selected, str) or selected not in captions:
                    continue
                formats = sorted((item for item in captions[selected] if item.get('ext') in order), key=lambda item: order[item['ext']])
                for item in formats:
                    parsed = urlparse(item.get('url', ''))
                    identity = parse_qs(parsed.query).get('v', [])
                    if parsed.scheme != 'https' or parsed.hostname not in {'www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com'} or parsed.path != '/api/timedtext' or parsed.username or parsed.password or parsed.port or identity and identity != [video_id]:
                        continue
                    offered = True
                    remaining = deadline - time.monotonic()
                    if remaining <= 1 or attempts >= 8:
                        raise ValueError('Source captions could not be loaded')
                    attempts += 1
                    try:
                        with session.get(parsed.geturl(), timeout=(min(8, remaining), min(15, remaining)), allow_redirects=False, stream=True) as response:
                            if response.status_code != 200:
                                continue
                            chunks = []
                            size = 0
                            for chunk in response.iter_content(32768):
                                size += len(chunk)
                                if size > 2097152 or time.monotonic() >= deadline:
                                    raise ValueError('Caption response exceeded its limits')
                                chunks.append(chunk)
                            cues = parse_caption(b''.join(chunks).decode('utf-8-sig'), item['ext'])
                    except (requests.RequestException, ValueError, TypeError, ET.ParseError, UnicodeError):
                        continue
                    if cues:
                        return {**empty, 'available': True, 'cues': cues, 'text': '\n'.join(cue['text'] for cue in cues), 'language': selected, 'automatic': automatic}
    if offered:
        raise ValueError('Source captions could not be loaded')
    return empty


if __name__ == '__main__':
    try:
        payload = json.load(sys.stdin)
        result = transcript(payload['videoId'], payload['creatorId'], payload.get('language', 'id'))
        print(json.dumps(result, ensure_ascii=False))
    except Exception:
        print(json.dumps({'error': 'TRANSCRIPT_UNAVAILABLE'}))
