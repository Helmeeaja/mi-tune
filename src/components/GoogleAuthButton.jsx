import { useEffect, useRef, useState } from 'react'
import { request } from '../lib/api.js'
import { hasNativePlayer } from '../lib/native-player.mjs'
import { useTranslation } from '../lib/i18n.jsx'

export default function GoogleAuthButton({ link = false, connected = false }) {
  const { t } = useTranslation()
  const [config,setConfig]=useState(null)
  const [error,setError]=useState('')
  const popup=useRef(null)
  const native=hasNativePlayer()
  useEffect(()=>{let cancelled=false;request('/auth/google/config').then(value=>{if(!cancelled)setConfig(value)}).catch(()=>{if(!cancelled)setConfig({enabled:false})});return()=>{cancelled=true}},[])
  useEffect(()=>{
    const complete=event=>{
      if(event.origin!==location.origin||event.source!==popup.current||event.data?.type!=='mi-tune:google-auth-complete')return
      if(event.data.success){setError('');window.dispatchEvent(new Event('mi-tune:google-auth'))}
      else setError('Login Google belum berhasil. Coba lagi.')
      popup.current=null
    }
    window.addEventListener('message',complete)
    if(new URLSearchParams(location.search).get('google')==='failed')setError('Login Google belum berhasil. Coba lagi.')
    return()=>window.removeEventListener('message',complete)
  },[])
  function start(){
    if(!config?.enabled||native||connected)return
    const target=new URL(config.startUrl)
    if(target.origin!==location.origin){setError('Buka aplikasi dari alamat yang dikonfigurasi untuk Google OAuth.');return}
    const next=new URLSearchParams(location.search).get('next')||'/'
    target.searchParams.set('next',next)
    if(link)target.searchParams.set('link','1')
    popup.current=window.open(target.href,'mi-tune-google-login','popup,width=520,height=680')
    if(!popup.current)setError('Izinkan popup untuk masuk dengan Google.')
  }
  return <div className="space-y-2"><button type="button" onClick={start} disabled={!config?.enabled||native||connected} className="clay-button !min-h-12 w-full justify-center !rounded-full disabled:opacity-60"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" data-ui-icon><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4a4.6 4.6 0 0 1-2 3.1v2.6h3.3c2-1.8 2.9-4.4 2.9-7.5ZM12 22c2.7 0 5-1 6.7-2.3l-3.3-2.6c-.9.6-2.1.9-3.4.9-2.6 0-4.8-1.7-5.6-4H3v2.7A10 10 0 0 0 12 22ZM6.4 14a6 6 0 0 1 0-4V7.3H3a10 10 0 0 0 0 9.4L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3 7.3L6.4 10c.8-2.3 3-4 5.6-4Z"/></svg>{t(connected?'Google sudah terhubung':link?'Hubungkan Google':'Lanjutkan dengan Google')}</button>{native?<p className="text-center text-[10px] leading-6 text-muted">{t('Login Google tersedia di versi web. Di APK, gunakan login akun Mi Tune dulu.')}</p>:config&&!config.enabled&&<p className="text-center text-[10px] leading-6 text-muted">{t('Login Google belum disiapkan. Username dan password tetap bisa dipakai.')}</p>}{error&&<p role="alert" className="notice text-xs">{t(error)}</p>}</div>
}
