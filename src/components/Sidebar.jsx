import { useTranslation } from "../lib/i18n.jsx";
import { motion, useReducedMotion } from 'framer-motion';
import { House, Search, Library, Download, UsersRound, Disc3, Plus, Heart, ArrowDownToLine, ArrowUpRight, Settings2, UserRound, Mic2 } from 'lucide-react';
import PlaylistCover from './PlaylistCover.jsx';
import Avatar from './Avatar.jsx';
import { motionTokens } from '../lib/motion.js';
export default function Sidebar({
  view,
  user,
  library,
  tracksFor,
  selectedPlaylist,
  onNavigate,
  onPlaylist,
  onCreate,
  onInstall,
  installed,
  downloadsCount,
  incomingCount
}) {
  const {
    t,
    locale
  } = useTranslation();
  return <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[224px] flex-col border-r border-line px-5 py-6 lg:flex" style={{
    background: 'var(--clay-sidebar, var(--color-canvas))'
  }}>
    <a href="/" onClick={event => {
      event.preventDefault();
      onNavigate('discover');
    }} className="mb-7 flex items-center gap-3 px-2" aria-label={t("Mi Tune beranda")}><span className="play-button !size-11 !rounded-[16px]"><Disc3 size={23} strokeWidth={1.8} /></span><span className="text-xl font-extrabold tracking-[-.065em]">{t("Mi Tune")}<span className="text-accent">{t(".")}</span></span></a>
    <nav aria-label={t("Navigasi utama")} className="space-y-1"><NavLink name={t("Jelajahi")} href="/" icon={<House size={18} />} active={view === 'discover'} onNavigate={() => onNavigate('discover')} /><NavLink name={t("Cari musik")} href="/search" icon={<Search size={18} />} active={view === 'search'} onNavigate={() => onNavigate('search')} /><NavLink name={t("Podcast")} href="/podcasts" icon={<Mic2 size={18} />} active={view === 'podcasts' || view === 'podcast-creator' || view === 'podcast-episode'} onNavigate={() => onNavigate('podcasts')} /><NavLink name={t("Koleksi")} href="/library" icon={<Library size={18} />} active={view === 'library'} onNavigate={() => onNavigate('library')} /><NavLink name={t("Unduhan")} href="/downloads" icon={<Download size={18} />} active={view === 'downloads'} count={downloadsCount} onNavigate={() => onNavigate('downloads')} /><NavLink name={t("Teman")} href="/friends" icon={<UsersRound size={18} />} active={view === 'friends'} count={incomingCount} onNavigate={() => onNavigate('friends')} /></nav>
    <div className="mb-3 mt-6 flex items-center justify-between pl-4"><p className="eyebrow">{t("Ruang musikmu")}</p><button type="button" aria-label={t("Buat playlist dari navigasi")} onClick={onCreate} className="icon-button !size-11"><Plus size={16} /></button></div>
    <div className="scroll-area min-h-0 flex-1 space-y-2 overflow-y-auto" data-lenis-prevent><button type="button" onClick={() => onPlaylist('favorites')} className={`flex min-h-12 w-full items-center gap-3 rounded-[15px] px-3 text-left text-xs font-semibold ${view === 'library' && selectedPlaylist === 'favorites' ? 'bg-surface text-accent' : 'text-muted hover:bg-surface/50'}`}><span className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-accent-light text-accent"><Heart size={14} fill="currentColor" /></span>{t("Lagu favorit")}</button>{library.playlists.map(playlist => <button type="button" key={playlist.id} onClick={() => onPlaylist(playlist.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-[15px] px-3 text-left text-xs font-semibold ${view === 'library' && selectedPlaylist === playlist.id ? 'bg-surface text-accent' : 'text-muted hover:bg-surface/50'}`}><PlaylistCover playlist={playlist} tracks={tracksFor(playlist.trackIds)} className="!size-8 shrink-0 !rounded-[10px]" /><span className="truncate">{playlist.name}</span></button>)}</div>
    <div className="mt-4 space-y-1 border-t border-line pt-3"><NavLink name={t("Pengaturan")} href="/settings" icon={<Settings2 size={18} />} active={view === 'settings'} onNavigate={() => onNavigate('settings')} /><button type="button" onClick={() => onNavigate('profile')} data-active={view === 'profile'} className="nav-item !gap-2.5 !px-3">{user ? <Avatar person={user} className="!size-8 !rounded-[11px]" /> : <UserRound size={18} />}<span className="min-w-0"><span className="block truncate text-xs font-bold">{user?.displayName || t("Profilmu")}</span>{user && <span className="mt-0.5 block truncate text-[10px] text-muted">{t("@")}{user.username}</span>}</span></button></div>
    {!installed&&<button type="button" onClick={onInstall} className="clay-surface mt-3 flex min-h-12 items-center gap-2.5 !rounded-[16px] px-3 py-3 text-left"><ArrowDownToLine size={15} className="text-muted" /><span className="min-w-0 flex-1 text-xs font-bold">{t("Instal Mi Tune")}</span><ArrowUpRight size={13} className="text-muted" /></button>}
  </aside>;
}
function NavLink({
  name,
  href,
  icon,
  active,
  count,
  onNavigate
}) {
  const {
    t,
    locale
  } = useTranslation();
  const reduced = useReducedMotion();
  return <motion.a href={href} aria-current={active ? 'page' : undefined} data-active={active} whileTap={reduced ? undefined : {
    scale: motionTokens.scale.press
  }} onClick={event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate();
  }} className="nav-item">{icon}<span className="flex-1">{name}</span>{count > 0 && <span className="grid min-w-5 place-items-center rounded-lg bg-sage px-1 py-0.5 text-[9px] text-muted">{count}</span>}</motion.a>;
}
export function MobileNavigation({
  view,
  onNavigate,
  incomingCount
}) {
  const {
    t,
    locale
  } = useTranslation();
  return <nav aria-label={t("Navigasi mobile")} className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 items-center border-t border-line bg-surface px-1 pt-1.5 lg:hidden"><MobileLink name={t("Jelajahi")} href="/" icon={<House size={19} />} active={view === 'discover'} onNavigate={() => onNavigate('discover')} /><MobileLink name={t("Cari")} href="/search" icon={<Search size={19} />} active={view === 'search'} onNavigate={() => onNavigate('search')} /><MobileLink name={t("Podcast")} href="/podcasts" icon={<Mic2 size={19} />} active={view === 'podcasts' || view === 'podcast-creator' || view === 'podcast-episode'} onNavigate={() => onNavigate('podcasts')} /><MobileLink name={t("Koleksi")} href="/library" icon={<Library size={19} />} active={view === 'library'} onNavigate={() => onNavigate('library')} /><MobileLink name={t("Offline")} href="/downloads" icon={<Download size={19} />} active={view === 'downloads'} onNavigate={() => onNavigate('downloads')} /><MobileLink name={t("Teman")} href="/friends" icon={<UsersRound size={19} />} active={view === 'friends'} count={incomingCount} onNavigate={() => onNavigate('friends')} /></nav>;
}
function MobileLink({
  name,
  href,
  icon,
  active,
  count,
  onNavigate
}) {
  const {
    t,
    locale
  } = useTranslation();
  return <a href={href} aria-current={active ? 'page' : undefined} onClick={event => {
    event.preventDefault();
    onNavigate();
  }} className={`relative flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-[13px] px-1 pb-1 text-[9px] font-bold ${active ? 'text-accent' : 'text-muted'}`}>{icon}<span className="max-w-full truncate">{name}</span>{count > 0 && <span className="absolute right-2 top-1 size-1.5 rounded-full bg-accent" />}</a>;
}
