import { Search, LoaderCircle, AudioLines } from 'lucide-react'
import { ArtistCard, AlbumCard } from '../components/CatalogCards.jsx'
import { useTranslation } from '../lib/i18n.jsx'
import { PodcastResults } from '../components/PodcastCards.jsx'
import { PublicPlaylistCards } from '../components/PublicMusic.jsx'

export function SearchResults({ results = [], artists = [], albums = [], playlists = [], warnings = [], renderTracks, onArtist, onAlbum, onPublicPlaylist, onUser, busy = false, error = '' }) {
  const { t, locale } = useTranslation()
  return <div className="space-y-7" data-search-results>
    {error && <p role="alert" className="notice">{t(error)}</p>}
    {warnings.length > 0 && <div className="notice" role="status">{warnings.map((warning, index) => <p key={warning.code || index}>{t(typeof warning === 'string' ? warning : warning.message)}</p>)}</div>}
    {busy ? <div className="clay-panel flex items-center gap-3 p-8"><LoaderCircle size={21} className="motion-safe:animate-spin text-accent" /><p role="status" className="text-sm text-muted">{t('Mencari lagu, artis, dan album…')}</p></div> : <>
      {artists.length > 0 && <section aria-labelledby="search-artists"><div className="mb-4"><p className="eyebrow mb-2">{t('Temui pemilik suaranya')}</p><h2 id="search-artists" className="section-heading">{t('Artis')}</h2></div><div className="grid gap-3 sm:grid-cols-2">{artists.map(artist => <ArtistCard key={artist.id} artist={artist} onArtist={onArtist} />)}</div></section>}
      {albums.length > 0 && <section aria-labelledby="search-albums"><div className="mb-4"><p className="eyebrow mb-2">{t('Jelajahi rilisan')}</p><h2 id="search-albums" className="section-heading">{t('Album & rilisan')}</h2></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">{albums.map(album => <AlbumCard key={album.id} album={album} onAlbum={onAlbum} />)}</div></section>}
      {results.length > 0 && <section aria-labelledby="search-songs" className="clay-panel p-3 sm:p-5"><div className="mb-4 flex items-end justify-between gap-3 px-3"><h2 id="search-songs" className="section-heading">{t('Lagu')}</h2><p className="text-xs text-muted">{t('{count} lagu ditemukan', { count: results.length.toLocaleString(locale) })}</p></div>{renderTracks(results)}</section>}
      {playlists.length>0&&<section aria-labelledby="search-playlists"><h2 id="search-playlists" className="section-heading mb-4">{t('Playlist public')}</h2><PublicPlaylistCards playlists={playlists} onPlaylist={onPublicPlaylist} onUser={onUser}/></section>}
    </>}
  </div>
}

export default function SearchPage({ results = [], artists = [], albums = [], playlists = [], warnings = [], busy, searched, error, renderTracks, onSearch, onArtist, onAlbum, onPublicPlaylist, onUser, podcasts, podcastBusy, podcastError, onCreator, renderEpisodes }) {
  const { t } = useTranslation()
  const found = results.length > 0 || artists.length > 0 || albums.length > 0 || playlists.length>0 || podcasts?.creators?.length > 0 || podcasts?.episodes?.length > 0
  return <div data-page="search" className="space-y-7">
    <div><p className="eyebrow mb-3">{t('Temukan favorit berikutnya')}</p><h1 className="page-heading">{searched ? t('Hasil untuk “{query}”', { query: searched }) : t('Apa yang ingin kamu dengarkan?')}</h1><p className="mt-3 text-sm leading-7 text-muted">{t('Cari judul, artis, atau suasana. Temukan lagu, profil artis, dan rilisan dalam satu pencarian.')}</p></div>
    {!searched && <div className="clay-panel grid gap-6 overflow-hidden p-6 sm:grid-cols-[1fr_150px] sm:items-center"><div><span className="empty-icon mb-5"><AudioLines size={27} /></span><h2 className="section-heading">{t('Mulai dari rasa penasaran.')}</h2><p className="muted-copy mt-2">{t('Sebuah genre, artis baru, atau lagu yang teringat sepanjang hari.')}</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => onSearch('jazz songs')} className="clay-button">Jazz</button><button type="button" onClick={() => onSearch('indie folk songs')} className="clay-button">Indie folk</button><button type="button" onClick={() => onSearch('lagu Indonesia')} className="clay-button">Indonesia</button></div></div><img src="/artwork/studio.jpg" alt={t('Musik untuk dijelajahi')} className="hidden aspect-square w-full rounded-[25px] object-cover sm:block" /></div>}
    <SearchResults results={results} artists={artists} albums={albums} playlists={playlists} warnings={warnings} busy={busy} error={error} renderTracks={renderTracks} onArtist={onArtist} onAlbum={onAlbum} onPublicPlaylist={onPublicPlaylist} onUser={onUser}/>
    {searched && <PodcastResults data={podcasts} busy={podcastBusy} error={podcastError} onCreator={onCreator} renderEpisodes={renderEpisodes} />}
    {!busy && !podcastBusy && !found && searched && !error && <div className="clay-panel empty-state"><span className="empty-icon"><Search size={26} /></span><h2 className="section-heading">{t('Belum menemukan yang cocok')}</h2><p className="muted-copy">{t('Coba ejaan lain, judul lagu, atau nama artis.')}</p></div>}
  </div>
}
