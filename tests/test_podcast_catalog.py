import unittest
from server.podcast_catalog import duration, published, normalize_episode, image


class PodcastMetadataTests(unittest.TestCase):
    def test_duration_supports_real_podcast_lengths(self):
        self.assertEqual(duration('1 hr 13 min'), 4380)
        self.assertEqual(duration('1:13:42'), 4422)
        self.assertEqual(duration('22 min'), 1320)
        self.assertIsNone(duration('15K views'))
        self.assertIsNone(duration(40000))

    def test_views_and_dates_without_year_do_not_become_publication_dates(self):
        self.assertIsNone(published('15K views'))
        self.assertIsNone(published('Mar 15'))
        self.assertIsNone(published('invalid'))
        self.assertTrue(published('Jul 8, 2023').startswith('2023-07-08'))

    def test_music_is_not_reclassified_as_a_podcast(self):
        creator = {'id': 'UCaaaaaaaaaaaaaaaaaaaaaa', 'name': 'Explicit test fixture'}
        raw = {'videoId': 'abcdefghijk', 'title': 'Explicit fixture', 'duration': '30 min', 'videoType': 'MUSIC_VIDEO_TYPE_ATV'}
        self.assertIsNone(normalize_episode(raw, creator, 'MPSPPLaaaaaaaaaaaa', 'Fixture'))
        raw['videoType'] = 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE'
        self.assertEqual(normalize_episode(raw, creator, 'MPSPPLaaaaaaaaaaaa', 'Fixture')['type'], 'episode')

    def test_artwork_never_targets_local_or_non_google_hosts(self):
        self.assertEqual(image([{'url': 'http://127.0.0.1/secret', 'width': 1000, 'height': 1000}]), '')
        self.assertEqual(image([{'url': 'https://spotify.example/cover', 'width': 1000, 'height': 1000}]), '')


if __name__ == '__main__':
    unittest.main()
