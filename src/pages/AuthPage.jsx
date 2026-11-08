import { useTranslation } from "../lib/i18n.jsx";
import { useState } from 'react';
import { ArrowRight, ArrowLeft, Eye, EyeOff, LoaderCircle, Disc3, Heart, Library, UsersRound, Headphones } from 'lucide-react';
import { Cassette } from '../components/MusicMotion.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
export default function AuthPage({
  mode,
  busy,
  error,
  onSubmit,
  onMode,
  onGuest,
  returnLabel
}) {
  const {
    t,
    locale
  } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [validation, setValidation] = useState('');
  const register = mode === 'register';
  function submit(event) {
    const values = new FormData(event.currentTarget);
    if (register && values.get('password') !== values.get('confirmPassword')) {
      event.preventDefault();
      setValidation('Kedua password belum sama. Periksa sekali lagi.');
      event.currentTarget.elements.confirmPassword.focus();
      return;
    }
    setValidation('');
    onSubmit(event);
  }
  function changeMode(next) {
    setValidation('');
    setVisible(false);
    onMode(next);
  }
  return <div className="auth-layout mx-auto grid max-w-[1040px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,.95fr)] lg:gap-14">
    <section className="auth-story relative hidden min-h-[510px] flex-col justify-between rounded-[30px] bg-sage/45 p-8 lg:flex"><div><div className="mb-8 flex items-center gap-2 text-accent"><Headphones size={22} /><span className="eyebrow">{t("Satu ruang. Banyak lagu.")}</span></div><h1 className="max-w-xs text-[53px] font-extrabold leading-[1.1] tracking-[-.065em]">{t("Musiknya tetap.")}<br /><span className="text-accent">{t("Ruangnya jadi milikmu.")}</span></h1><p className="mt-5 max-w-xs text-sm leading-7 text-muted">{t("Simpan yang kamu suka. Susun untuk perjalanan pulang. Temukan teman yang seirama.")}</p></div><div className="mt-9 flex items-end justify-between gap-5"><Cassette title={t("Mi Tune · make it yours")} /><span aria-hidden="true" className="guest-record !size-20 !shrink-0"><span /><Disc3 size={25} /></span></div><p className="mt-7 text-[11px] leading-6 text-muted">{t("Akun Mi Tune, bukan akun YouTube.")}<br />{t("Kamu tidak perlu menghubungkan layanan lain.")}</p></section>
    <section className="clay-panel min-w-0 px-6 py-8 sm:px-9 sm:py-10"><button type="button" onClick={onGuest} className="mb-6 flex min-h-11 items-center gap-2 text-xs font-bold text-muted"><ArrowLeft size={15} />{t("Kembali ke musik")}</button><p className="eyebrow mb-3">{register ? t("Tempat untuk koleksimu") : t("Senang kamu kembali")}</p><h2 className="page-heading">{register ? t("Buat ruang musikmu.") : t("Masuk, lalu tekan putar.")}</h2><p className="muted-copy mt-3">{register ? t("Favorit, playlist, unduhan, dan teman punya tempat sendiri.") : t("Koleksi dan teman musikmu menunggu di sini.")}</p>
      <div className="mt-6"><GoogleAuthButton/><div className="mt-5 flex items-center gap-3 text-[10px] text-muted"><span className="h-px flex-1 bg-line"/>{t('atau pakai akun Mi Tune')}<span className="h-px flex-1 bg-line"/></div></div>
      <form key={mode} onSubmit={submit} className="mt-5 space-y-5" aria-busy={busy}>
        {register && <label className="block text-xs font-bold" htmlFor="auth-name">{t("Nama tampilan")}<input id="auth-name" name="displayName" required maxLength={60} autoComplete="name" placeholder={t("Nama yang ingin kamu pakai")} disabled={busy} className="clay-input mt-2" /></label>}
        <label className="block text-xs font-bold" htmlFor="auth-username">{t("Username")}<input id="auth-username" name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={t("username_kamu")} disabled={busy} className="clay-input mt-2" />{register && <span className="mt-2 block text-[10px] font-normal leading-5 text-muted">{t("3–24 huruf, angka, atau underscore. Bisa diubah nanti.")}</span>}</label>
        <label className="block text-xs font-bold" htmlFor="auth-password">{t("Password")}<span className="relative mt-2 block"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} required minLength={register ? 8 : 1} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? t("Minimal 8 karakter") : t("Password akunmu")} disabled={busy} className="clay-input !pr-14" /><button type="button" aria-label={visible ? t("Sembunyikan password") : t("Tampilkan password")} aria-pressed={visible} onClick={() => setVisible(value => !value)} className="icon-button absolute right-1 top-1/2 -translate-y-1/2">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        {register && <label className="block text-xs font-bold" htmlFor="auth-confirm">{t("Ulangi password")}<input id="auth-confirm" name="confirmPassword" type={visible ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" disabled={busy} placeholder={t("Ketik sekali lagi")} onChange={() => validation && setValidation('')} className="clay-input mt-2" /></label>}
        {(validation || error) && <p role="alert" className="notice !text-xs">{t(validation || error)}</p>}
        <button type="submit" disabled={busy} className="clay-button clay-primary !min-h-12 w-full">{busy ? <LoaderCircle size={17} className="motion-safe:animate-spin" /> : <ArrowRight size={17} />}{busy ? register ? t("Menyiapkan akunmu…") : t("Menghubungkan akunmu…") : register ? t("Buat akun Mi Tune") : t("Masuk ke Mi Tune")}</button>
      </form>
      <p className="mt-6 text-center text-xs leading-6 text-muted">{register ? t("Sudah punya akun?") : t("Belum punya akun?")} <button type="button" disabled={busy} onClick={() => changeMode(register ? 'login' : 'register')} className="min-h-11 px-2 font-bold text-accent">{register ? t("Masuk di sini") : t("Buat akun")}</button></p>
      <div className="mt-4 flex items-center justify-center gap-4 border-t border-line pt-5 text-muted" aria-hidden="true"><Heart size={15} /><Library size={15} /><UsersRound size={15} /></div><p className="mt-3 text-center text-[10px] leading-6 text-muted">{returnLabel || t("Musik tetap berjalan.")} {t("Menjelajahi dan memutar musik tetap gratis tanpa akun.")}</p>
    </section>
  </div>;
}
