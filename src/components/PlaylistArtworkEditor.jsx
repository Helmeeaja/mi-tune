import { useTranslation } from "../lib/i18n.jsx";
import { useState } from 'react';
import { ImagePlus, Check, Upload, LoaderCircle } from 'lucide-react';
import Modal from './Modal.jsx';
async function prepareImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Gunakan gambar JPG, PNG, atau WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Gambar maksimal 8 MB. Pilih gambar yang lebih kecil.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Gambar ini tidak dapat dibaca.');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Perangkatmu tidak mendukung pengolahan gambar.');
    context.fillStyle = '#f4efe7';
    context.fillRect(0, 0, 512, 512);
    context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 512, 512);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
export default function PlaylistArtworkEditor({
  playlist,
  onSave,
  onClose
}) {
  const {
    t,
    locale
  } = useTranslation();
  const [cover, setCover] = useState(playlist.cover || null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      setCover(await prepareImage(file));
    } catch (cause) {
      setError(cause.message || 'Gambar tidak dapat dibaca.');
    } finally {
      setProcessing(false);
      event.target.value = '';
    }
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(cover);
      onClose();
    } catch (cause) {
      setError(cause.message || 'Sampul belum tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }
  return <Modal title={t("Sampul playlist")} onClose={() => {
    if (!busy) onClose();
  }}>
    <form onSubmit={save}>
      <div className="mx-auto mb-5 size-36 overflow-hidden rounded-[24px] bg-sage">{cover ? <img src={cover} alt={t("Pratinjau sampul playlist")} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted"><ImagePlus size={40} strokeWidth={1.25} /></div>}</div>
      <p className="mb-4 text-center text-sm text-muted">{t("Beri")} <span className="font-bold text-ink">{playlist.name}</span> {t("suasananya sendiri.")}</p>
      <div className="grid grid-cols-3 gap-3">
        <CoverOption name={t("Dawn")} path="/artwork/dawn.jpg" selected={cover} onSelect={setCover} />
        <CoverOption name={t("After hours")} path="/artwork/afterhours.jpg" selected={cover} onSelect={setCover} />
        <CoverOption name={t("Coast")} path="/artwork/coast.jpg" selected={cover} onSelect={setCover} />
        <CoverOption name={t("Forest")} path="/artwork/forest.jpg" selected={cover} onSelect={setCover} />
        <CoverOption name={t("Studio")} path="/artwork/studio.jpg" selected={cover} onSelect={setCover} />
        <CoverOption name={t("City")} path="/artwork/city.jpg" selected={cover} onSelect={setCover} />
      </div>
      <label className="clay-button mt-5 flex w-full cursor-pointer"><Upload size={17} />{processing ? t("Mengolah gambar…") : t("Unggah gambar sendiri")}<input type="file" aria-label={t("Unggah gambar sampul")} accept="image/jpeg,image/png,image/webp" disabled={busy || processing} onChange={upload} className="sr-only" /></label>
      <p className="mt-2 text-center text-xs leading-5 text-muted">{t("JPG, PNG, atau WebP · maksimal 8 MB")}<br />{t("Gambar dipotong persegi dan dioptimalkan otomatis.")}</p>
      <button type="button" onClick={() => setCover(null)} className="mt-3 min-h-11 w-full text-xs font-bold text-muted underline underline-offset-4">{t("Gunakan artwork lagu")}</button>
      {error && <p role="alert" className="notice mt-3">{t(error)}</p>}
      <button type="submit" disabled={busy || processing} className="clay-button clay-primary mt-4 w-full">{busy && <LoaderCircle size={16} className="motion-safe:animate-spin" />}{t("Simpan sampul")}</button>
    </form>
  </Modal>;
}
function CoverOption({
  name,
  path,
  selected,
  onSelect
}) {
  const {
    t,
    locale
  } = useTranslation();
  return <button type="button" aria-label={t("Pilih sampul {value0}", {
    value0: name
  })} aria-pressed={selected === path} onClick={() => onSelect(path)} className={`relative overflow-hidden rounded-[15px] border-2 text-left ${selected === path ? 'border-accent' : 'border-transparent'}`}>
    <img src={path} alt="" className="aspect-square w-full object-cover" />
    {selected === path && <span className="absolute right-1.5 top-1.5 rounded-full bg-accent p-1 text-white"><Check size={12} /></span>}
    <span className="absolute inset-x-0 bottom-0 bg-ink/65 px-2 py-1.5 text-[10px] font-bold text-white">{name}</span>
  </button>;
}
