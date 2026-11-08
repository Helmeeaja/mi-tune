import { useTranslation } from "../lib/i18n.jsx";
import { Plus, Check, Download, FileText, ListMusic, X, ArrowUp, Shuffle, Repeat, Repeat1, SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, LoaderCircle, ArrowDownToLine } from 'lucide-react';
import Modal from './Modal.jsx';
import GuestPrompt from './GuestPrompt.jsx';
import Cover from './Cover.jsx';
import PlaylistArtworkEditor from './PlaylistArtworkEditor.jsx';
import MobileMenu from './MobileMenu.jsx';
import { time } from './TrackRow.jsx';
export default function AppDialogs({
  modal,
  onClose,
  onLogin,
  onRegister,
  library,
  authMode,
  setAuthMode,
  authError,
  setAuthError,
  authBusy,
  onAuth,
  playlistName,
  setPlaylistName,
  playlistBusy,
  playlistError,
  onCreate,
  onNewPlaylist,
  onAdd,
  onArtwork,
  rename,
  setRename,
  onRename,
  onDeletePlaylist,
  rightsConfirmed,
  setRightsConfirmed,
  onDownload,
  onDeleteDownload,
  onImportLyrics,
  queue,
  setQueue,
  current,
  playing,
  loading,
  position,
  duration,
  volume,
  muted,
  shuffle,
  repeat,
  onShuffle,
  onRepeat,
  onPrevious,
  onNext,
  onPlay,
  onToggle,
  onSeek,
  onMute,
  onVolume,
  onDetail,
  onRemoveFriend,
  onNavigate,
  onInstall,
  onFavorites,
  installed,
  downloadsCount,
  incomingCount
}) {
  const {
    t,
    locale
  } = useTranslation();
  if (!modal) return null;
  if (modal.type === 'mobile-menu') return <MobileMenu user={user} installed={installed} downloadsCount={downloadsCount} incomingCount={incomingCount} onClose={onClose} onNavigate={onNavigate} onInstall={onInstall} onCreate={onNewPlaylist} onFavorites={onFavorites} />;
  if (modal.type === 'guest') return <Modal title={t("Musikmu, ruangmu.")} onClose={onClose}><GuestPrompt feature={modal.feature} compact onLogin={onLogin} onRegister={onRegister} onDismiss={onClose} /></Modal>;
  if (modal.type === 'auth') return <Modal title={authMode === 'login' ? t("Selamat datang kembali.") : t("Ruang musik milikmu.")} onClose={onClose}>
    <div className="mb-5 flex rounded-[15px] bg-canvas p-1"><button type="button" onClick={() => {
        setAuthMode('login');
        setAuthError('');
      }} className={`min-h-10 flex-1 rounded-xl text-xs font-bold ${authMode === 'login' ? 'bg-surface text-accent shadow-sm' : 'text-muted'}`}>{t("Masuk")}</button><button type="button" onClick={() => {
        setAuthMode('register');
        setAuthError('');
      }} className={`min-h-10 flex-1 rounded-xl text-xs font-bold ${authMode === 'register' ? 'bg-surface text-accent shadow-sm' : 'text-muted'}`}>{t("Buat akun")}</button></div>
    <form onSubmit={onAuth} className="space-y-4">
      {authMode === 'register' && <label className="block text-xs font-bold">{t("Nama tampilan")}<input name="displayName" required minLength={2} maxLength={60} autoComplete="name" className="clay-input mt-2" /></label>}
      <label className="block text-xs font-bold">{t("Username")}<input name="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" className="clay-input mt-2" /></label>
      <label className="block text-xs font-bold">{t("Password")}<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} className="clay-input mt-2" /></label>
      {authError && <p role="alert" className="notice">{t(authError)}</p>}
      <button type="submit" disabled={authBusy} className="clay-button clay-primary w-full">{authBusy && <LoaderCircle size={16} className="motion-safe:animate-spin" />}{authMode === 'login' ? t("Masuk ke Mi Tune") : t("Buat akun")}</button>
    </form>
    <p className="mt-5 text-xs leading-6 text-muted">{t("Akun Mi Tune hanya untuk koleksi dan pertemanan. Tidak menggunakan akun atau cookies YouTube.")}</p>
  </Modal>;
  if (modal.type === 'new-playlist') return <Modal title={t("Playlist baru")} onClose={onClose}><form onSubmit={onCreate}><label className="text-xs font-bold">{t("Nama playlist")}<input autoFocus required maxLength={60} value={playlistName} onChange={event => setPlaylistName(event.target.value)} placeholder={t("Misalnya, perjalanan pulang")} className="clay-input mt-3" /></label>{modal.track && <p className="mt-4 text-xs leading-6 text-muted">{modal.track.title} {t("akan menjadi lagu pertamanya.")}</p>}{playlistError && <p role="alert" className="notice mt-4">{playlistError}</p>}<button type="submit" disabled={playlistBusy} className="clay-button clay-primary mt-5 w-full"><Plus size={16} />{t("Buat playlist")}</button></form></Modal>;
  if (modal.type === 'add-playlist') return <Modal title={t("Tambah ke playlist")} onClose={onClose}><div className="mb-5 flex items-center gap-3 rounded-[18px] bg-canvas p-3"><Cover track={modal.track} className="size-12" /><div className="min-w-0"><p className="truncate text-sm font-bold">{modal.track.title}</p><p className="mt-1 truncate text-xs text-muted">{modal.track.artist}</p></div></div><div className="space-y-2">{library.playlists.map(playlist => <button type="button" key={playlist.id} disabled={playlist.trackIds.includes(modal.track.id)} onClick={() => onAdd(playlist, modal.track)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[15px] bg-canvas px-4 text-left text-sm font-bold disabled:opacity-50"><span className="truncate">{playlist.name}</span>{playlist.trackIds.includes(modal.track.id) ? <Check size={16} /> : <Plus size={16} />}</button>)}</div><button type="button" onClick={() => onNewPlaylist(modal.track)} className="clay-button mt-5 w-full"><Plus size={16} />{t("Playlist baru")}</button></Modal>;
  if (modal.type === 'artwork') return <PlaylistArtworkEditor playlist={modal.playlist} onSave={cover => onArtwork(modal.playlist, cover)} onClose={onClose} />;
  if (modal.type === 'rename') return <Modal title={t("Ubah nama playlist")} onClose={onClose}><form onSubmit={onRename}><label className="text-xs font-bold">{t("Nama playlist")}<input autoFocus required maxLength={60} value={rename} onChange={event => setRename(event.target.value)} className="clay-input mt-3" /></label>{playlistError && <p role="alert" className="notice mt-4">{playlistError}</p>}<button type="submit" disabled={playlistBusy} className="clay-button clay-primary mt-5 w-full">{t("Simpan nama")}</button></form></Modal>;
  if (modal.type === 'delete-playlist') return <Modal title={t("Hapus playlist?")} onClose={onClose}><p className="muted-copy">{t("Hapus playlist “")}{modal.playlist.name}{t("”? Lagu, favorit, dan unduhanmu tidak ikut dihapus.")}</p><div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="clay-button flex-1">{t("Batal")}</button><button type="button" onClick={() => onDeletePlaylist(modal.playlist)} className="clay-button clay-primary flex-1">{t("Hapus playlist")}</button></div></Modal>;
  if (modal.type === 'download') return <Modal title={t("Simpan untuk offline")} onClose={onClose}><div className="mb-5 flex items-center gap-3 rounded-[18px] bg-canvas p-3"><Cover track={modal.track} className="size-12" /><div className="min-w-0"><p className="truncate text-sm font-bold">{modal.track.title}</p><p className="mt-1 truncate text-xs text-muted">{modal.track.artist}</p></div></div><p className="muted-copy">{t("Audio lengkap, artwork, dan lirik yang tersedia akan disimpan di perangkatmu.")}</p><label className="mt-5 flex items-start gap-3 rounded-[18px] bg-canvas p-4 text-xs leading-6 text-muted"><input type="checkbox" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-accent" /><span>{t("Saya memiliki hak atau izin untuk mengunduh dan mengonversi konten ini.")}</span></label><button type="button" disabled={!rightsConfirmed} onClick={onDownload} className="clay-button clay-primary mt-5 w-full"><Download size={16} />{t("Unduh lagu")}</button></Modal>;
  if (modal.type === 'remove-download') return <Modal title={t("Hapus unduhan?")} onClose={onClose}><p className="muted-copy">{t("Audio offline “")}{modal.track.title}{t("” akan dihapus dari perangkatmu. Favorit dan playlist tetap ada.")}</p><div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="clay-button flex-1">{t("Batal")}</button><button type="button" onClick={() => onDeleteDownload(modal.track)} className="clay-button clay-primary flex-1">{t("Hapus unduhan")}</button></div></Modal>;
  if (modal.type === 'import-lrc') return <Modal title={t("Impor lirik LRC")} onClose={onClose}><p className="muted-copy">{t("Tambahkan lirik bertimestamp untuk “")}{modal.track.title}{t("”. Baris lirik akan mengikuti posisi audio.")}</p><label className="clay-button mt-5 flex w-full cursor-pointer"><FileText size={17} />{t("Pilih file LRC")}<input type="file" aria-label={t("File lirik LRC")} accept=".lrc,text/plain" onChange={event => onImportLyrics(event, modal.track)} className="sr-only" /></label><p className="mt-3 text-xs text-muted">{t("Format .lrc · maksimal 100 KB")}</p></Modal>;
  if (modal.type === 'queue') return <Modal title={t("Antrean pemutaran")} onClose={onClose}>
    <div className="mb-5 rounded-[20px] bg-canvas p-4">
      <div className="flex items-center justify-center gap-1"><button type="button" aria-label={t("Acak antrean")} aria-pressed={shuffle} onClick={onShuffle} className={`icon-button ${shuffle ? 'text-accent' : ''}`}><Shuffle size={17} /></button><button type="button" aria-label={t("Lagu sebelumnya")} disabled={!current} onClick={() => {
          onPrevious();
          onClose();
        }} className="icon-button"><SkipBack size={20} fill="currentColor" /></button><button type="button" aria-label={playing ? t("Jeda musik di antrean") : t("Putar musik di antrean")} onClick={onToggle} disabled={!current || loading} className="play-button !size-12">{loading ? <LoaderCircle size={20} className="motion-safe:animate-spin" /> : playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button><button type="button" aria-label={t("Lagu berikutnya")} disabled={!current} onClick={() => {
          onNext();
          onClose();
        }} className="icon-button"><SkipForward size={20} fill="currentColor" /></button><button type="button" aria-label={t("Ulangi: {value0}", {
          value0: repeat === 'off' ? t('mati') : repeat === 'one' ? t('satu') : t('semua')
        })} onClick={onRepeat} className={`icon-button ${repeat !== 'off' ? 'text-accent' : ''}`}>{repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}</button></div>
      <input type="range" aria-label={t("Posisi pemutaran")} min="0" max={duration || 1} step="0.1" value={Math.min(position, duration || 1)} disabled={!current || loading} onChange={event => onSeek(Number(event.target.value))} className="mt-3 h-8 w-full" /><div className="flex justify-between text-[10px] tabular-nums text-muted"><span>{time(position)}</span><span>{time(duration)}</span></div>
      <div className="mt-2 flex items-center justify-center gap-2"><button type="button" aria-label={muted ? t("Aktifkan suara") : t("Bisukan")} onClick={onMute} className="icon-button !size-9">{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><input type="range" aria-label={t("Volume")} min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={event => onVolume(Number(event.target.value))} className="h-7 w-28" /><button type="button" onClick={() => onDetail(current)} disabled={!current} className="icon-button" aria-label={t("Buka lirik")}><FileText size={17} /></button></div>
    </div>
    {queue.length ? <div className="space-y-2">{queue.map((track, index) => <div key={track.id} className={`flex items-center gap-2 rounded-[16px] p-2 ${current?.id === track.id ? 'bg-accent-light/35' : 'bg-canvas/50'}`}><span className="w-4 text-center text-[10px] text-muted">{index + 1}</span><Cover track={track} className="size-10" /><button type="button" onClick={() => onPlay(track, queue)} className="min-w-0 flex-1 px-1 py-2 text-left"><span className="block truncate text-xs font-bold">{track.title}</span><span className="mt-1 block truncate text-[10px] text-muted">{track.artist}</span></button><button type="button" aria-label={t("Naikkan antrean {value0}", {
          value0: track.title
        })} disabled={index === 0} onClick={() => setQueue(previous => {
          const updated = [...previous];
          [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
          return updated;
        })} className="icon-button !size-8"><ArrowUp size={14} /></button><button type="button" aria-label={t("Hapus antrean {value0}", {
          value0: track.title
        })} onClick={() => setQueue(previous => previous.filter(item => item.id !== track.id))} className="icon-button !size-8"><X size={14} /></button></div>)}</div> : <div className="empty-state !py-8"><span className="empty-icon"><ListMusic size={28} /></span><p className="muted-copy">{t("Belum ada lagu dalam antrean.")}</p></div>}
  </Modal>;
  if (modal.type === 'remove-friend') return <Modal title={t("Hapus pertemanan?")} onClose={onClose}><p className="muted-copy">{t("Hapus @")}{modal.person.username} {t("dari daftar teman?")}</p><div className="mt-6 flex gap-3"><button type="button" onClick={onClose} className="clay-button flex-1">{t("Batal")}</button><button type="button" onClick={() => onRemoveFriend(modal.person)} className="clay-button clay-primary flex-1">{t("Hapus teman")}</button></div></Modal>;
  if (modal.type === 'install') return <Modal title={t("Mi Tune, lebih dekat.")} onClose={onClose}><div className="install-guide"><img src="/icons/icon-192.png" alt="" width="72" height="72" /><p className="muted-copy">{t('Buka Mi Tune langsung dari layar utama, tanpa tab browser.')}</p>{/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? <ol><li>{t('Buka situs ini di Safari.')}</li><li>{t('Ketuk Bagikan di toolbar browser.')}</li><li>{t('Pilih Tambahkan ke Layar Utama, lalu Tambahkan.')}</li></ol> : <ol><li>{t('Buka situs ini di Chrome atau Edge.')}</li><li>{t('Buka menu browser, lalu pilih Instal aplikasi atau Tambahkan ke layar utama.')}</li><li>{t('Konfirmasi instalasi, lalu buka ikon Mi Tune.')}</li></ol>}<p className="text-xs leading-6 text-muted">{t('Musik dan katalog tetap membutuhkan internet. App shell, pengaturan lokal, dan koleksi yang sudah tersimpan bisa dibuka offline.')}</p><p className="text-xs leading-6 text-muted">{t('Jika menu instalasi belum muncul, muat ulang setelah situs selesai dimuat. Instalasi memerlukan HTTPS.')}</p><button type="button" onClick={onClose} className="clay-button clay-primary w-full">{t("Mengerti")}</button></div></Modal>;
  return null;
}
