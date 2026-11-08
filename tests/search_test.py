import unittest
from unittest.mock import patch

from server.music_search import TimeoutSession, search_songs


class MusicSearchTests(unittest.TestCase):
    def test_only_song_art_tracks_are_returned(self):
        song = {
            "resultType": "song",
            "videoType": "MUSIC_VIDEO_TYPE_ATV",
            "videoId": "aaaaaaaaaaa",
            "title": "Explicit test fixture",
            "artists": [{"name": "Fixture artist"}],
            "album": {"name": "Fixture album"},
            "duration_seconds": 120,
            "thumbnails": [],
        }
        rows = [
            song,
            song,
            {**song, "resultType": "video", "videoId": "bbbbbbbbbbb"},
            {**song, "resultType": "episode", "videoId": "ccccccccccc"},
            {**song, "videoType": "MUSIC_VIDEO_TYPE_OMV", "videoId": "ddddddddddd"},
            {**song, "duration_seconds": 7200, "videoId": "eeeeeeeeeee"},
        ]
        with patch("server.music_search.YTMusic") as client:
            client.return_value.search.return_value = rows
            result = search_songs("fixture")
            self.assertEqual([row["videoId"] for row in result], ["aaaaaaaaaaa"])
            client.return_value.search.assert_called_once_with(
                "fixture", filter="songs", limit=20, ignore_spelling=True
            )

    def test_video_urls_are_rejected_before_a_source_request(self):
        with patch("server.music_search.YTMusic") as client:
            for query in ("x", "https://youtube.com/watch?v=aaaaaaaaaaa", "www.youtube.com"):
                with self.assertRaises(ValueError):
                    search_songs(query)
            client.assert_not_called()

    def test_transient_requests_have_a_single_bounded_retry(self):
        with TimeoutSession() as session:
            retries = session.get_adapter("https://music.youtube.com").max_retries
            self.assertEqual(retries.total, 1)
            self.assertEqual(retries.read, 1)
            self.assertEqual(retries.connect, 1)
            self.assertIn("POST", retries.allowed_methods)
            self.assertIn(503, retries.status_forcelist)


if __name__ == "__main__":
    unittest.main()
