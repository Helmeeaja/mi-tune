import { useTranslation } from "../lib/i18n.jsx";
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Palette, Type, Headphones, Focus, SlidersHorizontal, ImagePlus, RotateCcw, ArrowUpRight, Check, LoaderCircle, Timer, Accessibility } from 'lucide-react';
import { prepareImage } from '../lib/image.js';
import Modal from '../components/Modal.jsx';
export default function SettingsPage({
  settings,
  onChange,
  onReset,
  user,
  online,
  storage,
  onProfile,
  onInstall,
  installed,
  nativePlayer = false,
  onNativeServer
}) {
  const {
    t,
    locale
  } = useTranslation();
  const [section, setSection] = useState('appearance');
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = settings.theme === 'dark' || settings.theme === 'system' && systemDark;
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  async function background(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageBusy(true);
    setError('');
    try {
      onChange({
        backgroundImage: await prepareImage(file, {
          dimension: 1600,
          maxBytes: 900000
        })
      });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setImageBusy(false);
    }
  }
  return <div data-page="settings" className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-3">{t("Atur supaya terasa milikmu")}</p><h1 className="page-heading">{t("Pas untuk telingamu.")}<br /><span className="text-accent">{t("Nyaman untuk matamu.")}</span></h1><p className="muted-copy mt-3">{t("Perubahan langsung berlaku dan tersimpan di perangkatmu.")}</p></div><span role="status" className="inline-flex items-center gap-2 rounded-full bg-sage/60 px-3 py-2 text-[10px] font-bold text-muted"><Check size={13} />{t("Tersimpan otomatis")}</span></div>
    <section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Bahasa aplikasi")}</h2><p className="muted-copy mt-2">{t("Pilih bahasa untuk semua halaman, menu, dan notifikasi.")}</p><label htmlFor="app-language" className="mt-5 flex flex-wrap items-center justify-between gap-4 text-xs font-bold">{t("Bahasa aplikasi")}<select id="app-language" value={settings.language} onChange={event => onChange({
          language: event.target.value
        })} className="clay-input !w-full sm:!w-auto"><option value="id">{t("Bahasa Indonesia")}</option><option value="en">{t("English")}</option></select></label></section>
    <section className="clay-panel p-5 sm:p-7" data-native-playback={nativePlayer}><div className="flex items-center gap-3"><Headphones size={20} className="text-accent" /><h2 className="section-heading">{t('Player native Android')}</h2></div><p className="muted-copy mt-3">{t(nativePlayer ? 'Audio berjalan lewat player Android, bukan pemutar halaman web.' : 'Versi web mengikuti dukungan perangkat. Untuk background audio native, instal APK Android Mi Tune.')}</p>{nativePlayer && <><p className="muted-copy mt-2">{t('Tetap mendengarkan saat pindah aplikasi atau mengunci layar. Kontrolnya ada di notifikasi media.')}</p><button type="button" onClick={onNativeServer} className="clay-button mt-4">{t('Ubah alamat server')}<ArrowUpRight size={15} /></button></>}</section>
    <div className="grid items-start gap-5 xl:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label={t("Bagian pengaturan")} className="flex gap-1 overflow-x-auto rounded-[22px] bg-surface/65 p-2 xl:sticky xl:top-[104px] xl:flex-col" data-lenis-prevent>
        <button type="button" aria-current={section === 'appearance' ? 'page' : undefined} onClick={() => setSection('appearance')} className={`settings-tab ${section === 'appearance' ? 'bg-canvas text-accent' : ''}`}><Palette size={16} />{t("Tampilan")}</button>
        <button type="button" aria-current={section === 'playback' ? 'page' : undefined} onClick={() => setSection('playback')} className={`settings-tab ${section === 'playback' ? 'bg-canvas text-accent' : ''}`}><Headphones size={16} />{t("Pemutaran")}</button>
        <button type="button" aria-current={section === 'lyrics' ? 'page' : undefined} onClick={() => setSection('lyrics')} className={`settings-tab ${section === 'lyrics' ? 'bg-canvas text-accent' : ''}`}><Focus size={16} />{t("Lirik")}</button>
        <button type="button" aria-current={section === 'comfort' ? 'page' : undefined} onClick={() => setSection('comfort')} className={`settings-tab ${section === 'comfort' ? 'bg-canvas text-accent' : ''}`}><Accessibility size={16} />{t("Kenyamanan")}</button>
      </nav>
      <div className="min-w-0 space-y-5">
        {error && <p role="alert" className="notice">{t(error)}</p>}
        {section === 'appearance' && <>
          <section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Terang, gelap, atau ikut hari.")}</h2><p className="muted-copy mt-2">{t("Pilih tema yang nyaman untuk sesi mendengarkanmu.")}</p><div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            <button type="button" aria-pressed={settings.theme === 'light'} onClick={() => onChange({
                theme: 'light'
              })} className={`theme-choice ${settings.theme === 'light' ? 'border-accent !text-accent' : ''}`}><Sun size={21} /><span>{t("Terang")}</span></button>
            <button type="button" aria-pressed={settings.theme === 'dark'} onClick={() => onChange({
                theme: 'dark'
              })} className={`theme-choice ${settings.theme === 'dark' ? 'border-accent !text-accent' : ''}`}><Moon size={21} /><span>{t("Gelap")}</span></button>
            <button type="button" aria-pressed={settings.theme === 'system'} onClick={() => onChange({
                theme: 'system'
              })} className={`theme-choice ${settings.theme === 'system' ? 'border-accent !text-accent' : ''}`}><Monitor size={21} /><span>{t("Sistem")}</span></button>
          </div></section>
          <section className="clay-panel p-5 sm:p-7"><div className="flex items-center gap-3"><Type size={20} className="text-accent" /><h2 className="section-heading">{t("Baca tanpa menyipit.")}</h2></div><label className="mt-6 block text-xs font-bold" htmlFor="font-size">{t("Ukuran teks")} <span className="float-right tabular-nums text-muted">{settings.fontSize}{t("px")}</span><input id="font-size" type="range" min="14" max="20" step="1" value={settings.fontSize} onChange={event => onChange({
                fontSize: Number(event.target.value)
              })} className="mt-3 block h-9 w-full" /></label><p className="mt-3 rounded-[18px] bg-canvas px-4 py-4 text-sm leading-7">{t("Satu lagu bagus, satu jeda kecil. Biar musik menemani sisanya.")}</p><Toggle label={t("Tampilan ringkas")} copy={t("Kurangi jarak antar lagu, tanpa mengecilkan tombol.")} checked={settings.compactMode} onChange={value => onChange({
              compactMode: value
            })} /></section>
          <section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Sentuhan warnamu.")}</h2><p className="muted-copy mt-2">{t("Warna bebas dipilih. Gunakan teks yang tetap kontras dengan latar.")}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Color label={t("Warna aksen")} value={settings.accentColor} onChange={value => onChange({
                accentColor: value
              })} /><Color label={t("Warna teks")} value={settings.textColor || (dark ? '#f4eade' : '#302c29')} onChange={value => onChange({
                textColor: value
              })} onClear={() => onChange({
                textColor: ''
              })} /><Color label={t("Warna ikon")} value={settings.iconColor || settings.accentColor} onChange={value => onChange({
                iconColor: value
              })} onClear={() => onChange({
                iconColor: ''
              })} /><Color label={t("Warna latar")} value={settings.backgroundColor || (dark ? '#211f1d' : '#f4efe7')} onChange={value => onChange({
                backgroundColor: value
              })} onClear={() => onChange({
                backgroundColor: ''
              })} /></div></section>
          <section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Latar yang kamu suka.")}</h2><p className="muted-copy mt-2">{t("Foto pribadi diperkecil dan hanya disimpan di perangkat ini.")}</p>{settings.backgroundImage && <img src={settings.backgroundImage} alt={t("Pratinjau latar pilihanmu")} className="mt-5 h-36 w-full rounded-[20px] object-cover" />}<div className="mt-5 flex flex-wrap gap-3"><label className={`clay-button ${imageBusy ? 'pointer-events-none opacity-50' : ''}`}>{imageBusy ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : <ImagePlus size={16} />}{t("Pilih foto")}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("Foto latar aplikasi")} disabled={imageBusy} onChange={background} className="sr-only" /></label>{settings.backgroundImage && <button type="button" onClick={() => onChange({
                backgroundImage: ''
              })} className="clay-button">{t("Hapus latar")}</button>}</div><p className="mt-3 text-[11px] leading-6 text-muted">{t("JPG, PNG, atau WebP · file awal maksimal 8 MB.")}</p></section>
        </>}
        {section === 'playback' && <section className="clay-panel p-5 sm:p-7"><div className="flex items-center gap-3"><SlidersHorizontal size={20} className="text-accent" /><h2 className="section-heading">{t("Musik, sesuai caramu.")}</h2></div><Toggle label={t("Siapkan lagu berikutnya")} copy={t("Hubungkan sumber berikutnya dan muat metadata saat lagu ini berjalan.")} checked={settings.preloadNext} disabled={settings.dataSaver} onChange={value => onChange({
            preloadNext: value
          })} /><Toggle label={t("Hemat data")} copy={t("Matikan persiapan lagu berikutnya dan pemuatan audio yang belum diputar.")} checked={settings.dataSaver} onChange={value => onChange({
            dataSaver: value
          })} /><Toggle label={t("Lanjutkan antrean otomatis")} copy={t("Setelah satu lagu selesai, putar lagu berikutnya. Ulang satu tetap berlaku.")} checked={settings.autoplayNext} onChange={value => onChange({
            autoplayNext: value
          })} /><div className="settings-row"><div className="min-w-0 flex-1"><label htmlFor="sleep-timer" className="text-sm font-bold">{t("Timer tidur")}</label><p className="mt-1.5 text-xs leading-6 text-muted">{t("Jeda otomatis selama aplikasi ini tetap terbuka.")}</p></div><div className="flex items-center gap-2"><Timer size={16} className="hidden text-muted sm:block" /><select id="sleep-timer" value={settings.sleepMinutes} onChange={event => onChange({
                sleepMinutes: Number(event.target.value)
              })} className="clay-input !w-auto !min-w-0 !px-3 !text-xs"><option value="0">{t("Mati")}</option><option value="15">{t("15 menit")}</option><option value="30">{t("30 menit")}</option><option value="45">{t("45 menit")}</option><option value="60">{t("60 menit")}</option><option value="90">{t("90 menit")}</option></select></div></div><p className="rounded-[18px] bg-canvas p-4 text-xs leading-6 text-muted">{t("Lagu yang sudah tersimpan diputar dari cache. Lagu baru dialirkan dari sumber tanpa menunggu konversi MP3; waktu koneksi awal tetap mengikuti sumber musik.")}</p></section>}
        {section === 'lyrics' && <section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Tetap dekat dengan lagunya.")}</h2><Toggle label={t("Ikuti lirik aktif")} copy={t("Baris yang sedang dinyanyikan tetap di tengah. Gulir manual untuk berhenti mengikuti sementara.")} checked={settings.followLyrics} onChange={value => onChange({
            followLyrics: value
          })} /><label htmlFor="lyric-size" className="mt-5 block text-xs font-bold">{t("Ukuran lirik")} <span className="float-right text-muted">{Math.round(settings.lyricSize * 100)}{t("%")}</span><input id="lyric-size" type="range" min="0.85" max="1.6" step="0.05" value={settings.lyricSize} onChange={event => onChange({
              lyricSize: Number(event.target.value)
            })} className="mt-3 block h-9 w-full" /></label><label htmlFor="lyric-offset" className="mt-6 block text-xs font-bold">{t("Penyesuaian waktu")} <span className="float-right tabular-nums text-muted">{settings.lyricOffset > 0 ? t("+") : ''}{settings.lyricOffset.toFixed(2)} {t("detik")}</span><input id="lyric-offset" type="range" min="-10" max="10" step="0.25" value={settings.lyricOffset} onChange={event => onChange({
              lyricOffset: Number(event.target.value)
            })} className="mt-3 block h-9 w-full" /></label><p className="mt-2 text-xs leading-6 text-muted">{t("Tambah nilainya jika lirik muncul terlambat, kurangi jika terlalu cepat. Ini menggeser tampilan lirik, bukan audio.")}</p><button type="button" onClick={() => onChange({
            lyricOffset: 0,
            lyricSize: 1
          })} className="clay-button mt-5 !text-xs">{t("Kembalikan ukuran & waktu")}</button></section>}
        {section === 'comfort' && <><section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Lebih tenang, lebih ringan.")}</h2><Toggle label={t("Animasi lembut")} copy={t("Umpan balik tombol dan perpindahan sampul. Preferensi reduced motion perangkat selalu dihormati.")} checked={settings.animations} onChange={value => onChange({
              animations: value
            })} /><Toggle label={t("Gulir halus")} copy={t("Haluskan roda mouse desktop. Sentuhan dan panel lirik tetap memakai gulir native.")} checked={settings.smoothScroll} disabled={!settings.animations} onChange={value => onChange({
              smoothScroll: value
            })} /><Toggle label={t("Pintasan keyboard")} copy={t("Spasi untuk putar/jeda, panah kiri/kanan untuk mundur/maju 5 detik. Tidak aktif saat mengetik.")} checked={settings.keyboardShortcuts} onChange={value => onChange({
              keyboardShortcuts: value
            })} /></section><section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Perangkat & akun")}</h2><div className="settings-row"><div><p className="text-sm font-bold">{user ? user.displayName : t("Mendengarkan sebagai tamu")}</p><p className="mt-1.5 text-xs text-muted">{user ? t("@{value0}", {
                    value0: user.username
                  }) : t("Musik tetap boleh dinikmati tanpa akun.")}</p></div><button type="button" onClick={onProfile} className="clay-button !px-3 !text-xs">{user ? t("Profil") : t("Akun")}<ArrowUpRight size={14} /></button></div><div className="settings-row"><div><p className="text-sm font-bold">{t("Mi Tune di perangkatmu")}</p><p className="mt-1.5 text-xs leading-6 text-muted">{online ? t("Terhubung ke internet.") : t("Sedang offline.")}{storage?.usage ? t(" Perangkatmu memakai {value0} MB.", {
                    value0: (storage.usage / 1024 ** 2).toFixed(1)
                  }) : ''}</p></div>{!installed&&<button type="button" onClick={onInstall} className="clay-button !px-3 !text-xs">{t("Instal")}</button>}</div></section></>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line px-5 py-4"><p className="text-xs leading-6 text-muted">{t("Reset hanya mengubah pengaturan, bukan koleksi atau akun.")}</p><button type="button" onClick={() => setResetOpen(true)} className="clay-button !px-3 !text-xs"><RotateCcw size={14} />{t("Reset")}</button></div>
      </div>
    </div>
    {resetOpen && <Modal title={t("Mulai dari pengaturan awal?")} onClose={() => setResetOpen(false)}><p className="muted-copy">{t("Tema, warna, latar, lirik, dan preferensi pemutaran kembali ke pengaturan awal. Lagu dan profil tetap aman.")}</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setResetOpen(false)} className="clay-button flex-1">{t("Batal")}</button><button type="button" onClick={() => {
          onReset();
          setResetOpen(false);
        }} className="clay-button clay-primary flex-1">{t("Reset pengaturan")}</button></div></Modal>}
  </div>;
}
function Toggle({
  label,
  copy,
  checked,
  onChange,
  disabled = false
}) {
  const {
    t,
    locale
  } = useTranslation();
  return <label className={`settings-row ${disabled ? 'opacity-50' : ''}`}><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className="mt-1.5 block text-xs leading-6 text-muted">{copy}</span></span><span className="relative inline-flex min-h-11 w-12 shrink-0 items-center"><input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xl focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed" /><span className="pointer-events-none h-6 w-11 rounded-full border border-line bg-line transition-colors peer-checked:border-accent peer-checked:bg-accent" /><span className={`pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-surface transition-transform ${checked ? 'translate-x-5' : ''}`} /></span></label>;
}
function Color({
  label,
  value,
  onChange,
  onClear
}) {
  const {
    t,
    locale
  } = useTranslation();
  return <div className="flex items-center gap-3 rounded-[18px] bg-canvas p-3"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-xs font-bold"><input type="color" aria-label={label} value={value} onChange={event => onChange(event.target.value)} className="h-10 w-11 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-1" /><span>{label}<span className="mt-1 block text-[10px] font-normal text-muted">{value.toUpperCase()}</span></span></label>{onClear && <button type="button" aria-label={t("Reset {value0}", {
      value0: label.toLowerCase()
    })} title={t("Ikuti tema lagi")} onClick={onClear} className="icon-button !size-11"><RotateCcw size={14} /></button>}</div>;
}
