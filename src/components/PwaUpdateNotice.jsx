import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useTranslation } from '../lib/i18n.jsx'

export default function PwaUpdateNotice({ playing, visible }) {
  const { t } = useTranslation()
  const [ready, setReady] = useState(Boolean(window.miTuneUpdateReady))
  useEffect(() => {
    const update = () => setReady(true)
    window.addEventListener('mi-tune:update-ready', update)
    return () => window.removeEventListener('mi-tune:update-ready', update)
  }, [])
  if (!ready || !visible) return null
  return <aside className="pwa-update" role="status"><RefreshCw size={19} aria-hidden="true" /><div><p>{t('Versi baru Mi Tune tersedia.')}</p>{playing && <span>{t('Jeda musik sebelum memuat ulang.')}</span>}</div><button type="button" disabled={playing} onClick={() => window.location.reload()}>{t('Muat ulang')}</button><button type="button" aria-label={t('Tutup pemberitahuan pembaruan')} onClick={() => setReady(false)} className="icon-button"><X size={17} /></button></aside>
}
