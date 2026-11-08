import json
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import music_charts


class SpotifyMetadataTests(unittest.TestCase):
    def html(self, rows, uri='spotify:playlist:37i9dQZEVXbMDoHDwVN2tF'):
        entity = {'uri': uri, 'title': 'Top 50 - Global', 'trackList': rows}
        data = {'props': {'pageProps': {'state': {'data': {'entity': entity}}}}}
        return '<script id="__NEXT_DATA__" type="application/json">' + json.dumps(data) + '</script>'

    def row(self, letter='a', title='Explicit Spotify metadata fixture'):
        return {'uri': 'spotify:track:' + letter * 22, 'title': title, 'subtitle': 'Fixture Artist', 'duration': 185000, 'audioPreview': {'url': 'https://must-not-fetch.example/audio'}}

    def test_published_spotify_order_identity_and_duration_are_metadata_only(self):
        response = Mock(status_code=200, text=self.html([self.row(), self.row('b', 'Second fixture')]))
        response.raise_for_status = Mock()
        session = Mock()
        session.get.return_value = response
        result = music_charts.get_spotify_metadata(session)
        self.assertEqual(result['chartId'], '37i9dQZEVXbMDoHDwVN2tF')
        self.assertEqual(result['sourceTotal'], 2)
        self.assertEqual(result['chartOrigin'], 'spotify')
        self.assertEqual(result['chartVersion'], 3)
        self.assertEqual([row['chartRank'] for row in result['entries']], [1, 2])
        self.assertEqual(result['entries'][0]['spotifyDuration'], 185)
        self.assertNotIn('audioPreview', json.dumps(result))
        self.assertNotIn('must-not-fetch', json.dumps(result))
        session.get.assert_called_once()

    def test_other_playlists_and_duplicate_or_malformed_track_tokens_are_rejected(self):
        for html in [self.html([self.row()], 'spotify:playlist:malformed'), self.html([self.row(), self.row()]), self.html([{**self.row(), 'uri': 'spotify:track:bad'}]), '<script id="__NEXT_DATA__">{broken}</script>']:
            response = Mock(status_code=200, text=html)
            session = Mock()
            session.get.return_value = response
            with self.assertRaises((ValueError, RuntimeError)):
                music_charts.get_spotify_metadata(session)

    def test_matching_cannot_accept_a_different_duration_or_unasked_version(self):
        entry = {'title': 'Fixture Song', 'artists': ['Fixture Artist'], 'spotifyDuration': 180, 'chartRank': 1}
        song = {'title': 'Fixture Song', 'artists': [{'name': 'Fixture Artist', 'id': 'UC' + 'a' * 22}], 'duration': 181, 'resultType': 'song', 'videoType': 'MUSIC_VIDEO_TYPE_ATV', 'videoId': 'abcdefghijk', 'thumbnail': ''}
        api = Mock()
        api.search.return_value = [song]
        self.assertIsNotNone(music_charts.resolve_spotify_entry(api, entry))
        api.search.return_value = [{**song, 'duration': 260}]
        self.assertIsNone(music_charts.resolve_spotify_entry(api, entry))
        api.search.return_value = [{**song, 'title': 'Fixture Song (Slowed + Reverb)'}]
        self.assertIsNone(music_charts.resolve_spotify_entry(api, entry))


if __name__ == '__main__':
    unittest.main()
