import json
import re
import sys
from html.parser import HTMLParser


class SpotifyChartParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title = []
        self.in_table = False
        self.in_body = False
        self.cell = None
        self.row = None
        self.link = None
        self.rows = []

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == 'span' and 'pagetitle' in attributes.get('class', '').split():
            self.in_title = True
        if tag == 'table' and attributes.get('id') == 'spotifydaily':
            self.in_table = True
        if self.in_table and tag == 'tbody':
            self.in_body = True
        if self.in_body and tag == 'tr':
            self.row = []
        if self.row is not None and tag == 'td':
            self.cell = {'text': [], 'links': []}
        if self.cell is not None and tag == 'a':
            self.link = {'href': attributes.get('href', ''), 'text': []}

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.cell is not None:
            self.cell['text'].append(data)
        if self.link is not None:
            self.link['text'].append(data)

    def handle_endtag(self, tag):
        if tag == 'span' and self.in_title:
            self.in_title = False
        if tag == 'a' and self.link is not None:
            self.link['text'] = ''.join(self.link['text']).strip()
            self.cell['links'].append(self.link)
            self.link = None
        if tag == 'td' and self.cell is not None:
            self.cell['text'] = ' '.join(''.join(self.cell['text']).split())
            self.row.append(self.cell)
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        if tag == 'tbody' and self.in_table:
            self.in_body = False
        if tag == 'table' and self.in_table:
            self.in_table = False


def parse_chart(html):
    parser = SpotifyChartParser()
    parser.feed(html)
    date = re.search(r'Spotify Daily Chart\s*-\s*Global\s*-\s*(\d{4})/(\d{2})/(\d{2})', ''.join(parser.title))
    if not date:
        raise ValueError('The Spotify global chart date is missing')
    tracks = []
    seen = set()
    for cells in parser.rows:
        if len(cells) != 11:
            raise ValueError('The Spotify chart table changed')
        rank = int(cells[0]['text'])
        links = cells[2]['links']
        track_links = [link for link in links if re.fullmatch(r'\.\./track/[A-Za-z0-9]{22}\.html', link['href'])]
        artists = [link['text'] for link in links if re.fullmatch(r'\.\./artist/[A-Za-z0-9]{22}\.html', link['href'])]
        if len(track_links) != 1 or not artists or not all(artists):
            raise ValueError('The Spotify chart identity is incomplete')
        link = track_links[0]
        track_id = link['href'].split('/')[-1][:-5]
        if rank != len(tracks) + 1 or track_id in seen or not link['text']:
            raise ValueError('The Spotify chart contains duplicated or missing positions')
        seen.add(track_id)
        streams = cells[6]['text'].replace(',', '')
        if not streams.isdigit() or int(streams) <= 0:
            raise ValueError('The Spotify stream count is invalid')
        tracks.append({'spotifyTrackId': track_id, 'title': link['text'], 'artists': artists, 'chartRank': rank, 'chartChange': cells[1]['text'], 'streams': int(streams)})
    if len(tracks) != 200:
        raise ValueError(f'Expected 200 Spotify chart positions, got {len(tracks)}')
    return {'chartDate': '-'.join(date.groups()), 'sourceTotal': len(tracks), 'entries': tracks}


if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(524289)
        if len(raw) > 524288:
            raise ValueError('The Spotify chart response is too large')
        print(json.dumps(parse_chart(raw.decode('utf-8')), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
