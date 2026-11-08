import { useEffect, useState } from 'react'
import { ArrowUpRight, Disc3, UserRound } from 'lucide-react'
import { useTranslation } from '../lib/i18n.jsx'

export function CatalogArtwork({ item, artist = false, className = '', eager = false }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const src = item?.thumbnail ? item.coverUrl || item.thumbnail : ''
  useEffect(() => setFailed(false), [item?.id, src])
  return <div className={`shrink-0 overflow-hidden bg-sage ${artist ? 'rounded-full' : 'rounded-[20px]'} ${className}`}>
    {src && !failed ? <img src={src} width={512} height={512} alt={artist ? t('Foto {name}', { name: item.name }) : t('Sampul {title}', { title: item.title })} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted">{artist ? <UserRound className="size-[38%]" strokeWidth={1.3} aria-hidden="true" /> : <Disc3 className="size-[42%]" strokeWidth={1.3} aria-hidden="true" />}</div>}
  </div>
}

export function ArtistCard({ artist, onArtist }) {
  const { t } = useTranslation()
  return <a href={`/artist/${encodeURIComponent(artist.id)}`} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onArtist(artist) }} data-artist-id={artist.id} className="catalog-artist clay-surface group flex min-h-[106px] min-w-0 items-center gap-4 p-4">
    <CatalogArtwork item={artist} artist className="size-16" />
    <div className="min-w-0 flex-1"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.12em] text-muted">{t('Artis')}</p><h3 className="truncate text-sm font-extrabold">{artist.name}</h3></div><ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  </a>
}

export function AlbumCard({ album, onAlbum }) {
  const { t } = useTranslation()
  const kind = /single/i.test(album.type || '') ? t('Single') : /ep/i.test(album.type || '') ? 'EP' : album.type === 'Release' ? t('Rilisan') : t('Album')
  return <a href={`/album/${encodeURIComponent(album.id)}`} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onAlbum(album) }} data-album-id={album.id} className="catalog-album clay-surface group block min-w-0 p-3">
    <CatalogArtwork item={album} className="aspect-square w-full !rounded-[16px]" />
    <div className="px-1 pb-1 pt-3"><p className="mb-1 text-[10px] font-semibold text-muted">{kind}{album.year ? ` · ${album.year}` : ''}</p><h3 className="truncate text-sm font-bold">{album.title}</h3>{album.artists?.length > 0 && <p className="mt-1 truncate text-xs text-muted">{album.artists.map(artist => typeof artist === 'string' ? artist : artist.name).filter(Boolean).join(', ')}</p>}</div>
  </a>
}

export function ArtistNames({ track, onArtist, className = '' }) {
  const refs = track?.artistRefs?.filter(artist => /^(?:UC[A-Za-z0-9_-]{22}|audius:user:[A-Za-z0-9]{1,64})$/.test(artist.id) && artist.name) || []
  if (!refs.length || !onArtist) return <span className={className}>{track?.artist}</span>
  return <span className={className}>{refs.map((artist, index) => <span key={artist.id}>{index > 0 && ', '}<a href={`/artist/${encodeURIComponent(artist.id)}`} onClick={event => { event.stopPropagation(); if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onArtist(artist) }} className="relative z-10 pointer-events-auto underline-offset-4 hover:underline">{artist.name}</a></span>)}</span>
}
