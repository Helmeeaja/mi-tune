import { useTranslation } from "../lib/i18n.jsx";
import { useEffect, useState } from 'react';
import { Camera, Check, LoaderCircle, LockKeyhole, LogOut, ArrowUpRight, UsersRound, Eye, EyeOff, UserRound, ShieldCheck } from 'lucide-react';
import Avatar from '../components/Avatar.jsx';
import GuestPrompt from '../components/GuestPrompt.jsx';
import Modal from '../components/Modal.jsx';
import { prepareImage } from '../lib/image.js';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
export default function ProfilePage({
  user,
  authReady,
  online,
  friends,
  onSave,
  onPassword,
  onLogout,
  onFriends,
  onAuth,
  onRegister,
  onPublicProfile
}) {
  const {
    t,
    locale
  } = useTranslation();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [likesVisibility,setLikesVisibility]=useState(user?.likesVisibility || 'private');
  useEffect(()=>setLikesVisibility(user?.likesVisibility || 'private'),[user?.likesVisibility]);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setUsername(user?.username || '');
    setBio(user?.bio || '');
    setEmail(user?.email || '');
    setAvatar(user?.avatar || null);
    setError('');
    setSaved(false);
  }, [user?.id]);
  const dirty = user && (displayName.trim() !== user.displayName || username !== user.username || bio.trim() !== (user.bio || '') || email.trim() !== (user.email || '') || avatar !== (user.avatar || null) || likesVisibility !== (user.likesVisibility || 'private'));
  async function photo(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageBusy(true);
    setError('');
    setSaved(false);
    try {
      setAvatar(await prepareImage(file, {
        dimension: 640
      }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setImageBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const patch = {
        displayName: displayName.trim(),
        username,
        bio: bio.trim(),
        email: email.trim(),
        avatar,
        likesVisibility
      };
      const result = await onSave(patch);
      setDisplayName(result.displayName);
      setUsername(result.username);
      setBio(result.bio || '');
      setEmail(result.email || '');
      setAvatar(result.avatar || null);
      setLikesVisibility(result.likesVisibility || 'private');
      setSaved(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  async function password(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (values.get('newPassword') !== values.get('confirmPassword')) {
      setPasswordError('Kedua password baru belum sama.');
      return;
    }
    if (values.get('newPassword') === values.get('currentPassword')) {
      setPasswordError('Pilih password baru yang berbeda dari sekarang.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError('');
    try {
      await onPassword({
        currentPassword: values.get('currentPassword'),
        newPassword: values.get('newPassword')
      });
      setPasswordOpen(false);
      setPasswordVisible(false);
    } catch (failure) {
      setPasswordError(failure.message);
    } finally {
      setPasswordBusy(false);
    }
  }
  async function logout() {
    setLogoutBusy(true);
    try {
      await onLogout();
      setLogoutOpen(false);
    } catch {
      setLogoutOpen(false);
    } finally {
      setLogoutBusy(false);
    }
  }
  if (!authReady) return <div role="status" className="clay-panel empty-state"><LoaderCircle size={24} className="motion-safe:animate-spin text-accent" /><p className="muted-copy">{t("Menghubungkan profilmu…")}</p></div>;
  if (!user) return <GuestPrompt feature="profile" onLogin={onAuth} onRegister={onRegister} />;
  return <div className="space-y-7">
    <div><p className="eyebrow mb-3">{t("Kenalkan dirimu")}</p><h1 className="page-heading">{t("Satu nama.")}<br /><span className="text-accent">{t("Banyak selera musik.")}</span></h1><p className="muted-copy mt-3">{t("Profil yang teman musikmu lihat, dan pengaturan akun yang hanya milikmu.")}</p></div>
    {!online && <p role="status" className="notice">{t("Profil tersimpan bisa dibaca. Sambungkan internet untuk menyimpan perubahan.")}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="clay-panel p-6 xl:sticky xl:top-[104px]"><Avatar person={{
          ...user,
          avatar,
          displayName
        }} className="!size-24 !rounded-[28px] !text-3xl" /><h2 className="mt-5 break-words text-xl font-extrabold tracking-tight">{user.displayName}</h2><p className="mt-2 break-all text-xs text-muted">{t("@")}{user.username}</p>{user.bio && <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-6 text-muted">{user.bio}</p>}<div className="mt-6 border-t border-line pt-5"><button type="button" onClick={onFriends} className="flex min-h-11 w-full items-center gap-2 text-xs font-bold"><UsersRound size={17} className="text-accent" /><span className="flex-1 text-left">{friends.friends.length} {t("teman musik")}</span><ArrowUpRight size={15} className="text-muted" /></button>{user.joinedAt && <p className="mt-3 text-[10px] leading-6 text-muted">{t("Bergabung")} {new Date(user.joinedAt).toLocaleDateString(locale, {
              month: 'long',
              year: 'numeric'
            })}</p>}</div></aside>
      <div className="min-w-0 space-y-5">
        <section className="clay-panel p-5"><h2 className="mb-4 text-sm font-extrabold">{t('Akun Google')}</h2><GoogleAuthButton link connected={user.googleConnected}/>{user.googleOnly&&<p className="mt-3 text-xs leading-6 text-muted">{t('Akun ini masuk lewat Google. Keamanan password dikelola di akun Googlemu.')}</p>}</section>
        <section className="clay-panel p-5 sm:p-7"><div className="flex items-center gap-3"><UserRound size={20} className="text-accent" /><h2 className="section-heading">{t("Profilmu")}</h2></div><section className="clay-panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"><div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">{t('Privasi koleksi')}</h2><p className="mt-2 text-xs leading-6 text-muted">{t('Playlist diatur dari Koleksi. Lagu favorit public hanya muncul di profilmu.')}</p><button type="button" onClick={onPublicProfile} className="mt-3 min-h-11 text-xs font-bold">{t('Lihat profil public')}<ArrowUpRight size={14} className="ml-2 inline"/></button></div><label className="flex flex-col gap-2 text-xs font-bold">{t('Lagu yang disukai')}<select value={likesVisibility} onChange={event=>{setLikesVisibility(event.target.value);setSaved(false)}} className="clay-button text-xs"><option value="private">{t('Private — hanya saya')}</option><option value="public">{t('Public — lewat profil')}</option></select></label></section><form onSubmit={save} className="mt-6 space-y-5" aria-busy={busy}>
          <div className="flex flex-wrap items-center gap-4 rounded-[20px] bg-canvas p-4"><Avatar person={{
                ...user,
                avatar,
                displayName
              }} className="!size-16 !rounded-[20px] !text-xl" /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{t("Foto profil")}</p><p className="mt-1 text-[10px] leading-5 text-muted">{t("JPG, PNG, atau WebP. Diperkecil sebelum disimpan.")}</p><div className="mt-2 flex flex-wrap gap-2"><label className={`clay-button !min-h-11 !px-3 !text-xs ${imageBusy || busy || !online ? 'pointer-events-none opacity-50' : ''}`}>{imageBusy ? <LoaderCircle size={14} className="motion-safe:animate-spin" /> : <Camera size={14} />}{t("Pilih foto")}<input type="file" aria-label={t("Pilih foto profil")} accept="image/jpeg,image/png,image/webp" disabled={imageBusy || busy || !online} onChange={photo} className="sr-only" /></label>{avatar && <button type="button" disabled={busy || !online} onClick={() => {
                    setAvatar(null);
                    setSaved(false);
                  }} className="min-h-11 px-3 text-xs font-bold text-muted">{t("Hapus foto")}</button>}</div></div></div>
          <div className="grid gap-5 sm:grid-cols-2"><label htmlFor="profile-name" className="block text-xs font-bold">{t("Nama tampilan")}<input id="profile-name" value={displayName} required maxLength={60} autoComplete="name" disabled={busy || !online} onChange={event => {
                  setDisplayName(event.target.value);
                  setSaved(false);
                }} className="clay-input mt-2" /></label><label htmlFor="profile-username" className="block text-xs font-bold">{t("Username")}<input id="profile-username" value={username} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoCapitalize="none" autoComplete="username" spellCheck={false} disabled={busy || !online} onChange={event => {
                  setUsername(event.target.value);
                  setSaved(false);
                }} className="clay-input mt-2" /><span className="mt-2 block text-[10px] font-normal leading-5 text-muted">{t("Username ini dipakai untuk masuk dan dicari teman.")}</span></label></div>
          <label htmlFor="profile-bio" className="block text-xs font-bold">{t("Bio singkat")}<textarea id="profile-bio" value={bio} maxLength={500} rows={3} placeholder={t("Lagu untuk pulang, atau cerita singkat tentangmu.")} disabled={busy || !online} onChange={event => {
                setBio(event.target.value);
                setSaved(false);
              }} className="clay-input mt-2 resize-y py-3 !leading-7" /><span className="mt-2 block text-right text-[10px] font-normal tabular-nums text-muted">{bio.length}{t("/500")}</span></label>
          <label htmlFor="profile-email" className="block text-xs font-bold">{t("Email")} <span className="font-normal text-muted">{t("(opsional, privat)")}</span><input id="profile-email" type="email" value={email} maxLength={254} autoComplete="email" placeholder={t("Email pribadi")} disabled={busy || !online} onChange={event => {
                setEmail(event.target.value);
                setSaved(false);
              }} className="clay-input mt-2" /><span className="mt-2 block text-[10px] font-normal leading-6 text-muted">{t("Tidak ditampilkan ke teman. Belum digunakan untuk pemulihan password.")}</span></label>
          {error && <p role="alert" className="notice !text-xs">{t(error)}</p>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5"><span role="status" className="text-xs text-muted">{saved ? <span className="flex items-center gap-2 text-accent"><Check size={15} />{t("Perubahan sudah tersimpan.")}</span> : dirty ? t("Ada perubahan yang belum disimpan.") : t("Profilmu sudah tersimpan.")}</span><button type="submit" disabled={busy || imageBusy || !online || !dirty} className="clay-button clay-primary !text-xs">{busy ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : <Check size={16} />}{t("Simpan profil")}</button></div>
        </form></section>
        <section className="clay-panel p-5 sm:p-7"><div className="flex items-center gap-3"><ShieldCheck size={20} className="text-accent" /><h2 className="section-heading">{t("Akun tetap aman.")}</h2></div><div className="settings-row"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{t("Ubah password")}</p><p className="mt-1.5 text-xs leading-6 text-muted">{t("Password baru menutup sesi di perangkat lain.")}</p></div><button type="button" disabled={!online||user.googleOnly} onClick={() => {
              setPasswordError('');
              setPasswordOpen(true);
            }} className="clay-button !px-3 !text-xs"><LockKeyhole size={14} />{t("Ubah")}</button></div><div className="settings-row"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{t("Keluar dari akun")}</p><p className="mt-1.5 text-xs leading-6 text-muted">{t("Musik tetap berjalan. Koleksi akun tidak ikut dihapus.")}</p></div><button type="button" disabled={!online} onClick={() => setLogoutOpen(true)} className="clay-button !px-3 !text-xs"><LogOut size={14} />{t("Keluar")}</button></div></section>
      </div>
    </div>
    {passwordOpen && <Modal title={t("Ganti passwordmu")} onClose={() => !passwordBusy && setPasswordOpen(false)}><form onSubmit={password} className="space-y-4"><label className="block text-xs font-bold">{t("Password sekarang")}<input name="currentPassword" type={passwordVisible ? 'text' : 'password'} required maxLength={128} autoComplete="current-password" disabled={passwordBusy} className="clay-input mt-2" /></label><label className="block text-xs font-bold">{t("Password baru")}<input name="newPassword" type={passwordVisible ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" disabled={passwordBusy} className="clay-input mt-2" /></label><label className="block text-xs font-bold">{t("Ulangi password baru")}<input name="confirmPassword" type={passwordVisible ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" disabled={passwordBusy} className="clay-input mt-2" /></label><button type="button" aria-pressed={passwordVisible} onClick={() => setPasswordVisible(value => !value)} className="flex min-h-11 items-center gap-2 text-xs font-bold text-muted">{passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}{passwordVisible ? t("Sembunyikan password") : t("Tampilkan password")}</button>{passwordError && <p role="alert" className="notice !text-xs">{t(passwordError)}</p>}<button type="submit" disabled={passwordBusy} className="clay-button clay-primary w-full">{passwordBusy && <LoaderCircle size={16} className="motion-safe:animate-spin" />}{t("Simpan password baru")}</button><p className="text-[10px] leading-6 text-muted">{t("8–128 karakter. Sesi di perangkat ini tetap berjalan.")}</p></form></Modal>}
    {logoutOpen && <Modal title={t("Sampai jumpa dulu?")} onClose={() => !logoutBusy && setLogoutOpen(false)}><p className="muted-copy">{t("Kamu akan keluar dari akun @")}{user.username}{t(". Musik yang sedang didengar tidak berhenti.")}</p>{dirty && <p className="notice mt-4 !text-xs">{t("Perubahan profil yang belum disimpan akan hilang.")}</p>}<div className="mt-6 flex gap-3"><button type="button" disabled={logoutBusy} onClick={() => setLogoutOpen(false)} className="clay-button flex-1">{t("Tetap di sini")}</button><button type="button" disabled={logoutBusy} onClick={logout} className="clay-button clay-primary flex-1">{logoutBusy && <LoaderCircle size={15} className="motion-safe:animate-spin" />}{t("Keluar")}</button></div></Modal>}
  </div>;
}
