import { useTranslation } from "../lib/i18n.jsx";
import { Search, ArrowRight, WifiOff, UserRound, Disc3, Settings2 } from 'lucide-react';
import Avatar from './Avatar.jsx';
export default function Header({
  query,
  onQuery,
  onSearch,
  searchBusy,
  user,
  authReady,
  online,
  onAuth,
  onProfile,
  onSettings,
  onHome,
  authPage = false
}) {
  const {
    t,
    locale
  } = useTranslation();
  if (authPage) return <header className="border-b border-line bg-canvas px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4"><a href="/" onClick={event => {
        event.preventDefault();
        onHome();
      }} aria-label={t("Mi Tune beranda")} className="flex min-h-11 items-center gap-3"><span className="play-button !size-10 !rounded-[14px]"><Disc3 size={21} /></span><span className="text-xl font-extrabold tracking-[-.055em]">{t("Mi Tune")}<span className="text-accent">{t(".")}</span></span></a><button type="button" onClick={onHome} className="min-h-11 px-2 text-xs font-bold text-muted">{t("Lanjut sebagai tamu")}</button></div></header>;
  return <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas px-5 py-4 sm:px-8 lg:px-9">
    <div className="mx-auto flex max-w-[1150px] flex-wrap items-center justify-between gap-4 lg:flex-nowrap">
      <a href="/" onClick={event => {
        event.preventDefault();
        onHome();
      }} aria-label={t("Mi Tune beranda mobile")} className="flex items-center gap-2.5 lg:hidden"><span className="play-button !size-9 !rounded-[13px]"><Disc3 size={20} /></span><span className="text-lg font-extrabold tracking-[-.055em]">{t("Mi Tune")}<span className="text-accent">{t(".")}</span></span></a>
      <form onSubmit={onSearch} className="order-3 w-full lg:order-1 lg:max-w-[510px]"><div className="relative flex min-h-12 items-center rounded-[18px] border border-line bg-surface px-3 focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"><Search size={18} className="ml-1 shrink-0 text-muted" /><input type="text" inputMode="search" enterKeyHint="search" id="music-search" aria-label={t("Cari lagu atau artis")} value={query} onChange={event => onQuery(event.target.value)} placeholder={t("Lagu atau artis…")} autoComplete="off" className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-xs outline-none placeholder:text-muted" /><button type="submit" aria-label={t("Cari musik sekarang")} disabled={searchBusy} className="icon-button !size-11 !rounded-[12px] bg-canvas disabled:opacity-40"><ArrowRight size={16} /></button></div></form>
      <div className="order-2 flex items-center gap-2">{!online && <span className="flex items-center gap-1.5 rounded-xl bg-sage px-2 py-2 text-[10px] font-bold text-muted"><WifiOff size={12} />{t("Offline")}</span>}<button type="button" onClick={onSettings} aria-label={t("Buka pengaturan")} title={t("Pengaturan")} className="icon-button"><Settings2 size={19} /></button>{user ? <button type="button" onClick={onProfile} aria-label={t("Buka profil {value0}", {
          value0: user.displayName
        })} className="flex min-h-11 items-center gap-3 rounded-[14px] px-1"><span className="hidden max-w-32 truncate text-xs font-semibold text-muted sm:block">{user.displayName}</span><Avatar person={user} className="!size-10 !rounded-[14px]" /></button> : <button type="button" onClick={onAuth} disabled={!authReady} className="clay-button !min-h-11 !px-3 !text-xs"><UserRound size={15} />{t("Masuk")}</button>}</div>
    </div>
  </header>;
}
