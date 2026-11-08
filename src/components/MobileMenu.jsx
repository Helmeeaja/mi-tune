import { ArrowDownToLine, Check, Download, Flame, Heart, House, Library, Mic2, Play, Plus, Search, Settings2, UserRound, UsersRound } from 'lucide-react'
import Avatar from './Avatar.jsx'
import Modal from './Modal.jsx'
import { useTranslation } from '../lib/i18n.jsx'

export default function MobileMenu({ user, view = 'discover', current, installed, downloadsCount, incomingCount, onClose, onNavigate, onInstall, onCreate, onFavorites, onDetail }) {
  const { t } = useTranslation()

  function navigate(event, page) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onClose()
    onNavigate(page)
  }

  function install() {
    onClose()
    onInstall()
  }

  return <Modal title={t('Ruang musikmu')} onClose={onClose}>
    <div className="mobile-menu">
      <a href="/profile" className="mobile-menu-profile" onClick={event => navigate(event, 'profile')}>
        {user ? <Avatar person={user} className="!size-14 !rounded-full" /> : <span className="mobile-menu-avatar"><UserRound size={24} /></span>}
        <span><strong>{user?.displayName || t('Profilmu')}</strong><span>{user ? `@${user.username}` : t('Masuk untuk menyimpan koleksimu')}</span></span>
      </a>
      <nav aria-label={t('Navigasi utama')} className="mobile-menu-pages">
        <a href="/" aria-current={view === 'discover' ? 'page' : undefined} onClick={event => navigate(event, 'discover')}><House size={21} aria-hidden="true" /><span>{t('Beranda')}</span></a>
        <a href="/search" aria-current={view === 'search' ? 'page' : undefined} onClick={event => navigate(event, 'search')}><Search size={21} aria-hidden="true" /><span>{t('Cari musik')}</span></a>
        <a href="/trending" aria-current={view === 'trending' ? 'page' : undefined} onClick={event => navigate(event, 'trending')}><Flame size={21} aria-hidden="true" /><span>{t('Musik yang sedang ramai')}</span></a>
        <a href="/podcasts" aria-current={view.startsWith('podcast') ? 'page' : undefined} onClick={event => navigate(event, 'podcasts')}><Mic2 size={21} aria-hidden="true" /><span>{t('Podcast')}</span></a>
        <a href="/library" aria-current={view === 'library' ? 'page' : undefined} onClick={event => navigate(event, 'library')}><Library size={21} aria-hidden="true" /><span>{t('Koleksi')}</span></a>
        <a href="/downloads" aria-current={view === 'downloads' ? 'page' : undefined} onClick={event => navigate(event, 'downloads')}><Download size={21} aria-hidden="true" /><span>{t('Unduhan')}</span>{downloadsCount > 0 && <span className="mobile-menu-count">{downloadsCount}</span>}</a>
        <a href="/friends" aria-current={view === 'friends' ? 'page' : undefined} onClick={event => navigate(event, 'friends')}><UsersRound size={21} aria-hidden="true" /><span>{t('Teman')}</span>{incomingCount > 0 && <span className="mobile-menu-count">{incomingCount}</span>}</a>
        <a href="/settings" aria-current={view === 'settings' ? 'page' : undefined} onClick={event => navigate(event, 'settings')}><Settings2 size={21} aria-hidden="true" /><span>{t('Pengaturan')}</span></a>
      </nav>
      {current && <button type="button" onClick={() => { onClose(); onDetail(current) }}><Play size={21} aria-hidden="true" /><span>{t('Sedang diputar')}</span></button>}
      <button type="button" onClick={() => { onClose(); onFavorites() }}><Heart size={21} aria-hidden="true" /><span>{t('Lagu favorit')}</span></button>
      <button type="button" onClick={() => { onClose(); onCreate() }}><Plus size={21} aria-hidden="true" /><span>{t('Buat playlist')}</span></button>
      {installed ? <p className="mobile-menu-installed"><Check size={18} aria-hidden="true" />{t('Mi Tune sudah terinstal.')}</p> : <button type="button" className="mobile-menu-install" onClick={install}><ArrowDownToLine size={21} aria-hidden="true" /><span>{t('Instal Mi Tune')}</span></button>}
    </div>
  </Modal>
}
