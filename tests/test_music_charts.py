import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))

from music_charts import chart_songs


def song(video_id, title="Fixture song", artist="Fixture artist", video_type="MUSIC_VIDEO_TYPE_ATV"):
    return {
        "videoId": video_id,
        "resultType": "song",
        "videoType": video_type,
        "title": title,
        "artists": [{"name": artist}],
        "album": {"name": "Fixture album"},
        "duration_seconds": 180,
        "thumbnails": [],
    }


class FixtureAPI:
    def __init__(self, tracks, results=None):
        self.tracks = tracks
        self.results = results or []
        self.country = None
        self.playlist_id = None
        self.queries = []

    def get_charts(self, country):
        self.country = country
        return {"videos": [
            {"title": "Top 100 Music Videos Global", "playlistId": "weekly_12345"},
            {"title": "Daily Top Music Videos - Global", "playlistId": "daily_12345"},
        ]}

    def get_playlist(self, playlist_id, limit):
        self.playlist_id = playlist_id
        return {"title": "Explicit global chart fixture", "trackCount": len(self.tracks), "tracks": self.tracks}

    def search(self, query, filter, limit, ignore_spelling):
        self.queries.append(query)
        if filter != "songs":
            raise AssertionError("Chart resolution must search official songs")
        return self.results


class MusicChartTests(unittest.TestCase):
    def test_global_daily_chart_is_the_default_not_indonesia_or_weekly(self):
        api = FixtureAPI([song("aaaaaaaaaaa")])
        result = chart_songs(api)
        self.assertEqual(api.country, "ZZ")
        self.assertEqual(api.playlist_id, "daily_12345")
        self.assertEqual(result["region"], "ZZ")
        self.assertEqual(result["sourceTotal"], 1)

    def test_official_chart_video_resolves_to_matching_audio_not_the_video(self):
        video = song("bbbbbbbbbbb", title="Fixture song (Official Video)", video_type="MUSIC_VIDEO_TYPE_OMV")
        api = FixtureAPI([video, song("ccccccccccc", title="Another song")], [
            song("ddddddddddd", artist="Wrong artist"),
            song("aaaaaaaaaaa"),
        ])
        result = chart_songs(api)
        self.assertEqual([item["videoId"] for item in result["tracks"]], ["aaaaaaaaaaa", "ccccccccccc"])
        self.assertEqual([item["chartRank"] for item in result["tracks"]], [1, 2])
        self.assertTrue(all(item["videoType"] == "MUSIC_VIDEO_TYPE_ATV" for item in result["tracks"]))
        self.assertEqual(result["sourceTotal"], 2)

    def test_unmatched_versions_and_generic_videos_do_not_become_songs(self):
        api = FixtureAPI([
            song("bbbbbbbbbbb", title="Fixture song (Live)", video_type="MUSIC_VIDEO_TYPE_OMV"),
            song("ccccccccccc", video_type="MUSIC_VIDEO_TYPE_UGC"),
            song("eeeeeeeeeee", title="Another song"),
        ], [song("aaaaaaaaaaa")])
        result = chart_songs(api)
        self.assertEqual([item["videoId"] for item in result["tracks"]], ["eeeeeeeeeee"])
        self.assertEqual(result["tracks"][0]["chartRank"], 3)
        self.assertEqual(len(api.queries), 1)

    def test_duplicate_audio_is_not_repeated_and_an_empty_chart_is_an_error(self):
        api = FixtureAPI([song("aaaaaaaaaaa"), song("aaaaaaaaaaa")])
        self.assertEqual(len(chart_songs(api)["tracks"]), 1)
        with self.assertRaises(ValueError):
            chart_songs(FixtureAPI([song("bbbbbbbbbbb", video_type="MUSIC_VIDEO_TYPE_OMV")]))


if __name__ == "__main__":
    unittest.main()
