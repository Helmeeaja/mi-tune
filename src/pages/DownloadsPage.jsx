import { useTranslation } from "../lib/i18n.jsx";
import { Download, Trash2, Check, HardDrive, WifiOff } from 'lucide-react';
export default function DownloadsPage({
  downloads,
  storage,
  offlineOwner,
  user,
  online,
  renderTracks,
  onRemove,
  bytes,
  onExplore
}) {
  const {
    t,
    locale
  } = useTranslation();
  const ownerDownloads = downloads.filter(item => (item.owner || 'guest') === offlineOwner);
  const total = ownerDownloads.reduce((sum, item) => sum + (item.size || 0), 0);
  return <div data-page="downloads" className="space-y-7">
    <div><p className="eyebrow mb-3">{t("Musik, tanpa jaringan")}</p><h1 className="page-heading">{t("Bawa musikmu.")}</h1><p className="mt-3 max-w-lg text-sm leading-7 text-muted">{t("Lagu yang sudah kamu unduh tetap bisa diputar saat offline. Audio, artwork, dan lirik yang tersedia disimpan bersama.")}</p></div>
    <section className="clay-panel flex flex-col gap-5 !bg-sage/60 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="clay-surface grid size-14 shrink-0 place-items-center !bg-surface/70 text-muted">{online ? <Download size={25} /> : <WifiOff size={25} />}</span><div><h2 className="text-lg font-extrabold tracking-tight">{ownerDownloads.length} {t("lagu siap didengar")}</h2><p className="mt-1 text-xs leading-6 text-muted">{online ? t("Siap untuk perjalanan berikutnya.") : t("Kamu offline. Musik yang tersimpan tetap berjalan.")}</p></div></div><div className="flex items-center gap-2 text-xs text-muted"><HardDrive size={15} /><span className="font-bold">{bytes(total)}</span><span>{t("audio tersimpan")}</span></div></section>
    {storage && <div className="px-1"><div className="mb-2 flex justify-between text-[10px] text-muted"><span>{t("Penyimpanan perangkat")}</span><span>{bytes(storage.usage)} {t("dari")} {bytes(storage.quota)}</span></div><div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-muted/40" style={{
          width: `${Math.min(100, storage.usage / (storage.quota || 1) * 100)}%`
        }} /></div></div>}
    <section aria-label={t("Musik offline")} className="clay-panel p-3 sm:p-5">{ownerDownloads.length ? renderTracks(ownerDownloads.map(item => item.track), track => <button type="button" aria-label={t("Hapus unduhan {value0}", {
        value0: track.title
      })} onClick={() => onRemove(track)} className="icon-button"><Trash2 size={16} /></button>) : <div className="empty-state"><span className="empty-icon"><Download size={28} /></span><h2 className="section-heading">{t("Belum ada lagu offline")}</h2><p className="max-w-sm text-sm leading-7 text-muted">{t("Tekan ikon unduh pada lagu pilihanmu. Setelah tersimpan, kamu bisa mendengarkannya tanpa internet.")}</p><button type="button" onClick={onExplore} className="clay-button clay-primary">{t("Temukan musik")}</button></div>}</section>
    <p className="flex items-start gap-2 px-1 text-[11px] leading-6 text-muted"><Check size={14} className="mt-1 shrink-0" />{user ? t("Unduhan untuk akun ini tersimpan pada perangkatmu.") : t("Unduhan tamu tersimpan pada perangkatmu, terpisah dari unduhan akun.")} {t("Gunakan hanya konten yang kamu miliki atau boleh diunduh.")}</p>
  </div>;
}
