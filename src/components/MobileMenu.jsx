import { ArrowDownToLine, Check, Download, Heart, Plus, Settings2, UserRound, UsersRound } from 'lucide-react'
import Avatar from './Avatar.jsx'
import Modal from './Modal.jsx'
import { useTranslation } from '../lib/i18n.jsx'

export default function MobileMenu({ user, installed, downloadsCount, incomingCount, onClose, onNavigate, onInstall, onCreate, onFavorites }) {
  const { t } = useTranslation()

  function navigate(view) {
    onClose()
    onNavigate(view)
  }

  function install() {
    onClose()
    onInstall()
  }

  return <Modal title={t('Ruang musikmu')} onClose={onClose}>
    <div className="mobile-menu">
      <button type="button" className="mobile-menu-profile" onClick={() => navigate('profile')}>
        {user ? <Avatar person={user} className="!size-14 !rounded-full" /> : <span className="mobile-menu-avatar"><UserRound size={24} /></span>}
        <span><strong>{user?.displayName || t('Profilmu')}</strong><span>{user ? `@${user.username}` : t('Masuk untuk menyimpan koleksimu')}</span></span>
      </button>
      <button type="button" onClick={() => navigate('downloads')}><Download size={21} aria-hidden="true" /><span>{t('Unduhan')}</span>{downloadsCount > 0 && <span className="mobile-menu-count">{downloadsCount}</span>}</button>
      <button type="button" onClick={() => navigate('friends')}><UsersRound size={21} aria-hidden="true" /><span>{t('Teman')}</span>{incomingCount > 0 && <span className="mobile-menu-count">{incomingCount}</span>}</button>
      <button type="button" onClick={() => { onClose(); onFavorites() }}><Heart size={21} aria-hidden="true" /><span>{t('Lagu favorit')}</span></button>
      <button type="button" onClick={() => { onClose(); onCreate() }}><Plus size={21} aria-hidden="true" /><span>{t('Buat playlist')}</span></button>
      <button type="button" onClick={() => navigate('settings')}><Settings2 size={21} aria-hidden="true" /><span>{t('Pengaturan')}</span></button>
      {installed ? <p className="mobile-menu-installed"><Check size={18} aria-hidden="true" />{t('Mi Tune sudah terinstal.')}</p> : <button type="button" className="mobile-menu-install" onClick={install}><ArrowDownToLine size={21} aria-hidden="true" /><span>{t('Instal Mi Tune')}</span></button>}
    </div>
  </Modal>
}
