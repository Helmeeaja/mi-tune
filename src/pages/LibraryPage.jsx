import { useTranslation } from "../lib/i18n.jsx";
import { motion, useReducedMotion } from 'framer-motion';
import { Heart, Plus, Play, Pause, ChevronLeft, Pencil, ImagePlus, Trash2, ArrowUp, ArrowDown, X, Library, LockKeyhole } from 'lucide-react';
import PlaylistCover from '../components/PlaylistCover.jsx';
import { motionTokens, springs } from '../lib/motion.js';
import { ArtistCard } from '../components/CatalogCards.jsx';
export default function LibraryPage({
  library,
  selected,
  tracksFor,
  error,
  user,
  current,
  playing,
  followedArtists = [],
  onArtist,
  onAuth,
  onSelect,
  onCreate,
  onRename,
  onArtwork,
  onDelete,
  onPlay,
  onMove,
  onRemove,
  renderTracks,
  onVisibility,
  visibilityBusy,
  onPublicPlaylist
}) {
  const {
    t,
    locale
  } = useTranslation();
  const reduced = useReducedMotion();
  const playlist = selected === 'favorites' ? {
    id: 'favorites',
    name: t('Lagu favorit'),
    trackIds: library.favoriteIds,
    cover: '/artwork/dawn.jpg'
  } : library.playlists.find(item => item.id === selected);
  const tracks = playlist ? tracksFor(playlist.trackIds) : [];
  const isPlayingCollection = playing && tracks.some(track => track.id === current?.id);
  return <div data-page="library" className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow mb-3">{t("Disimpan dengan hati")}</p><h1 className="page-heading">{t("Koleksi musikmu.")}</h1><p className="mt-3 text-sm text-muted">{t("Playlist untuk setiap suasana, lagu favorit untuk kapan saja.")}</p></div><motion.button type="button" aria-label={t("Playlist baru")} onClick={onCreate} whileTap={reduced ? undefined : {
        scale: motionTokens.scale.press
      }} className="clay-button clay-primary"><Plus size={17} />{t("Playlist baru")}</motion.button></div>
    {!user && <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-sage/60 px-5 py-4"><p className="flex items-center gap-2 text-xs leading-6 text-muted"><LockKeyhole size={15} className="shrink-0" />{t("Koleksi tersimpan di perangkatmu. Masuk untuk koleksi akun.")}</p><button type="button" onClick={onAuth} className="min-h-11 shrink-0 text-xs font-bold text-accent">{t("Masuk akun")}</button></div>}
    {error && <p role="alert" className="notice">{t(error)}</p>}
    {playlist ? <>
      <button type="button" onClick={() => onSelect(null)} className="flex min-h-11 items-center gap-2 text-xs font-bold text-muted"><ChevronLeft size={16} />{t("Semua koleksi")}</button>
      <section className="clay-panel flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-7">
        <div className="album-frame mx-auto w-44 shrink-0 sm:mx-0"><PlaylistCover playlist={playlist} tracks={tracks} className="!rounded-[18px]" /></div>
        <div className="min-w-0 flex-1"><p className="eyebrow mb-2">{selected === 'favorites' ? t("Selalu ingin didengar lagi") : t("Playlist personal")}</p><h2 className="break-words text-3xl font-extrabold leading-tight tracking-[-.045em]">{playlist.name}</h2><p className="mt-3 text-xs text-muted">{playlist.trackIds.length} {t("lagu ·")} {user?.displayName || t("Koleksi pribadi")}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2"><motion.button type="button" disabled={!tracks.length} aria-label={t("Putar koleksi")} whileTap={reduced ? undefined : {
              scale: motionTokens.scale.press
            }} onClick={() => onPlay(tracks[0], tracks)} className="clay-button clay-primary">{isPlayingCollection ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{t("Putar")}</motion.button>{selected !== 'favorites' && <><button type="button" onClick={() => onArtwork(playlist)} className="clay-button !px-3"><ImagePlus size={16} />{t("Ubah sampul")}</button><button type="button" onClick={() => onRename(playlist)} className="icon-button" aria-label={t("Ubah nama")} title={t("Ubah nama")}><Pencil size={17} /></button><button type="button" onClick={() => onDelete(playlist)} className="icon-button" aria-label={t("Hapus playlist")} title={t("Hapus playlist")}><Trash2 size={17} /></button></>}</div>
        </div>
      </section>
      {user&&<div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line p-4"><div><label htmlFor="collection-visibility" className="text-xs font-bold">{t('Privasi koleksi')}</label><p className="mt-2 max-w-lg text-xs leading-6 text-muted">{selected==='favorites'?t('Lagu favorit public hanya terlihat lewat profilmu.'):t('Playlist public bisa ditemukan dan didengar. Hanya kamu yang bisa mengubahnya.')}</p></div><div className="flex flex-wrap items-center gap-3"><select id="collection-visibility" value={selected==='favorites'?(user.likesVisibility||'private'):(playlist.visibility||'private')} disabled={visibilityBusy} onChange={event=>onVisibility(playlist.id,event.target.value)} className="clay-button text-xs"><option value="private">{t('Private — hanya saya')}</option><option value="public">{t('Public')}</option></select>{selected!=='favorites'&&playlist.visibility==='public'&&<button type="button" onClick={()=>onPublicPlaylist(playlist)} className="clay-button text-xs">{t('Lihat playlist public')}</button>}</div></div>}
      <section aria-label={t("Lagu dalam {value0}", {
        value0: playlist.name
      })} className="clay-panel p-3 sm:p-5">{tracks.length ? renderTracks(tracks, track => selected === 'favorites' ? null : <><button type="button" aria-label={t("Naikkan {value0}", {
            value0: track.title
          })} onClick={() => onMove(playlist, track.id, -1)} disabled={playlist.trackIds.indexOf(track.id) === 0} className="icon-button"><ArrowUp size={15} /></button><button type="button" aria-label={t("Turunkan {value0}", {
            value0: track.title
          })} onClick={() => onMove(playlist, track.id, 1)} disabled={playlist.trackIds.indexOf(track.id) === playlist.trackIds.length - 1} className="icon-button"><ArrowDown size={15} /></button><button type="button" aria-label={t("Hapus {value0} dari playlist", {
            value0: track.title
          })} onClick={() => onRemove(playlist, track.id)} className="icon-button"><X size={15} /></button></>) : <div className="empty-state"><span className="empty-icon">{selected === 'favorites' ? <Heart size={29} /> : <Library size={29} />}</span><h3 className="section-heading">{selected === 'favorites' ? t("Lagu yang kamu suka, di sini.") : t("Playlist ini menunggu lagu pertama.")}</h3><p className="muted-copy">{selected === 'favorites' ? t("Tekan ikon hati pada lagu untuk menyimpannya.") : t("Temukan lagu, lalu tekan tombol + untuk menambahkannya.")}</p></div>}</section>
    </> : <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
      <motion.button type="button" onClick={() => onSelect('favorites')} whileTap={reduced ? undefined : {
        scale: motionTokens.scale.press
      }} transition={springs.gentle} className="group min-w-0 text-left"><div className="clay-surface p-2.5"><div className="playlist-art relative"><img src="/artwork/dawn.jpg" alt={t("Artwork koleksi favorit")} className="size-full object-cover" /><span className="absolute bottom-4 right-4 grid size-12 place-items-center rounded-[18px] bg-surface/95 text-accent shadow-sm"><Heart size={23} fill="currentColor" /></span></div></div><h2 className="mt-3 px-1 text-sm font-bold">{t("Lagu favorit")}</h2><p className="mt-1 px-1 text-xs text-muted">{library.favoriteIds.length} {t("lagu yang kamu suka")}</p></motion.button>
      {library.playlists.map(item => <motion.button type="button" key={item.id} onClick={() => onSelect(item.id)} whileTap={reduced ? undefined : {
        scale: motionTokens.scale.press
      }} transition={springs.gentle} className="min-w-0 text-left"><div className="clay-surface p-2.5"><PlaylistCover playlist={item} tracks={tracksFor(item.trackIds)} /></div><h2 className="mt-3 truncate px-1 text-sm font-bold">{item.name}</h2><p className="mt-1 px-1 text-xs text-muted">{item.trackIds.length} {t("lagu · Playlist")}</p></motion.button>)}
      <button type="button" onClick={onCreate} className="min-w-0 text-left"><div className="grid aspect-square place-items-center rounded-[26px] border-2 border-dashed border-[#d4c8b7] bg-surface/25 text-muted"><div className="text-center"><span className="clay-surface mx-auto grid size-14 place-items-center"><Plus size={23} /></span><p className="mt-4 text-xs font-bold">{t("Buat ruang baru")}</p></div></div><p className="mt-3 px-1 text-sm font-bold text-muted">{t("Playlist berikutnya")}</p><p className="mt-1 px-1 text-xs text-muted">{t("Mulai dari satu lagu")}</p></button>
    </div>}
    {!playlist && user && <section aria-labelledby="library-artists"><div className="mb-5"><p className="eyebrow mb-2">{t("Suara yang kamu ikuti")}</p><h2 id="library-artists" className="section-heading">{t("Artis yang diikuti")}</h2></div>{followedArtists.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{followedArtists.map(artist => <ArtistCard key={artist.id} artist={artist} onArtist={onArtist} />)}</div> : <p className="clay-panel p-6 text-sm text-muted">{t("Ikuti artis dari profilnya. Mereka akan punya tempat sendiri di sini.")}</p>}</section>}
  </div>;
}
