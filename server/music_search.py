import json
import re
import sys

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from ytmusicapi import YTMusic


class TimeoutSession(requests.Session):
    def __init__(self):
        super().__init__()
        retries = Retry(
            total=1,
            connect=1,
            read=1,
            status=1,
            allowed_methods=frozenset({"GET", "POST"}),
            status_forcelist=(429, 500, 502, 503, 504),
            backoff_factor=0.5,
            respect_retry_after_header=False,
        )
        self.mount("https://", HTTPAdapter(max_retries=retries))

    def request(self, *args, **kwargs):
        kwargs.setdefault("timeout", (8, 18))
        return super().request(*args, **kwargs)


def search_songs(query):
    if not isinstance(query, str) or not 2 <= len(query) <= 160:
        raise ValueError("Cari judul lagu atau nama artis sepanjang 2–160 karakter.")
    if re.search(r"https?://|www\.", query, re.IGNORECASE):
        raise ValueError("Cari judul lagu atau artis, bukan URL video umum.")
    api = YTMusic(requests_session=TimeoutSession(), language="en", location="ID")
    results = api.search(query, filter="songs", limit=20, ignore_spelling=True)
    songs = []
    seen = set()
    for result in results:
        video_id = result.get("videoId", "")
        artists = [artist.get("name", "").strip() for artist in result.get("artists", []) if artist.get("name")]
        duration = result.get("duration_seconds")
        if result.get("resultType") != "song" or result.get("videoType") != "MUSIC_VIDEO_TYPE_ATV":
            continue
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id) or video_id in seen or not artists:
            continue
        if not isinstance(duration, (int, float)) or not 15 <= duration <= 1800:
            continue
        if not isinstance(result.get("title"), str) or not result["title"].strip():
            continue
        thumbnails = sorted(result.get("thumbnails", []), key=lambda image: image.get("width", 0), reverse=True)
        thumbnail = thumbnails[0].get("url", "") if thumbnails else ""
        songs.append({
            "videoId": video_id,
            "resultType": "song",
            "videoType": "MUSIC_VIDEO_TYPE_ATV",
            "title": result["title"],
            "artists": artists,
            "artistRefs": [{"id": artist["id"], "name": artist["name"].strip()} for artist in result.get("artists", []) if isinstance(artist.get("id"), str) and re.fullmatch(r"UC[A-Za-z0-9_-]{22}", artist["id"]) and artist.get("name")],
            "album": (result.get("album") or {}).get("name", ""),
            "albumId": (result.get("album") or {}).get("id"),
            "duration": duration,
            "thumbnail": thumbnail,
        })
        seen.add(video_id)
        if len(songs) == 20:
            break
    return songs


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Satu kata pencarian diperlukan.")
        print(json.dumps(search_songs(sys.argv[1]), ensure_ascii=False))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(2)
    except Exception:
        print("Pencarian YouTube Music sedang tidak tersedia. Coba lagi nanti.", file=sys.stderr)
        sys.exit(1)
