import { useTranslation } from "../lib/i18n.jsx";
import { Heart, Library, Download, UsersRound, ArrowRight, Headphones } from 'lucide-react';
export default function GuestPrompt({
  feature = 'playlist',
  onLogin,
  onRegister,
  onDismiss,
  compact = false
}) {
  const {
    t,
    locale
  } = useTranslation();
  const heading = feature === 'artist' ? t("Tetap dekat dengan artis favoritmu.") : feature === 'downloads' ? t("Bawa musikmu ke mana saja.") : feature === 'favorites' ? t("Simpan lagu yang bikin betah.") : feature === 'friends' ? t("Musik lebih seru bareng teman.") : feature === 'profile' ? t("Satu profil, selera musikmu.") : feature === 'session' ? t("Masuk lagi, yuk.") : t("Bikin ruang untuk musikmu.");
  const copy = feature === 'artist' ? t("Masuk untuk mengikuti artis dan menemukan profil mereka lagi dari koleksimu.") : feature === 'session' ? t("Sesi akunmu sudah berakhir. Musik tetap jalan, koleksimu tetap aman.") : feature === 'downloads' ? t("Masuk untuk menyimpan lagu dan mendengarkannya saat offline.") : feature === 'favorites' ? t("Masuk untuk menyimpan favoritmu. Nanti tinggal tekan putar.") : feature === 'friends' ? t("Cari teman, kirim undangan, dan ketemu lewat musik.") : feature === 'profile' ? t("Masuk untuk mengatur nama, foto, bio, dan keamanan akunmu.") : t("Playlist, favorit, dan teman musikmu punya tempat sendiri setelah kamu masuk.");
  return <section data-guest-prompt={feature} className={compact ? 'text-center' : 'clay-panel mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14'}>
    <div className="guest-record mx-auto mb-7" aria-hidden="true"><span /><Headphones size={28} strokeWidth={1.5} /></div>
    <div className="mx-auto max-w-md text-center"><p className="eyebrow mb-3">{t("Tetap boleh menikmati musik")}</p><h1 className={compact ? 'text-2xl font-extrabold leading-tight tracking-tight' : 'page-heading'}>{heading}</h1><p className="muted-copy mt-4">{copy}</p>
      <div className="my-7 flex justify-center gap-4 text-accent" aria-hidden="true"><Heart size={19} /><Library size={19} /><Download size={19} /><UsersRound size={19} /></div>
      <div className="flex flex-wrap justify-center gap-3"><button type="button" onClick={onLogin} className="clay-button clay-primary">{t("Masuk")}<ArrowRight size={16} /></button><button type="button" onClick={onRegister} className="clay-button">{t("Buat akun")}</button></div>
      {onDismiss && <button type="button" onClick={onDismiss} className="mt-5 min-h-11 px-4 text-xs font-semibold text-muted hover:text-ink">{t("Lanjut dengarkan dulu")}</button>}
    </div>
  </section>;
}
