import { useTranslation } from "../lib/i18n.jsx";
import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import Cover from './Cover.jsx';
export default function PlaylistCover({
  playlist,
  tracks = [],
  className = ''
}) {
  const {
    t,
    locale
  } = useTranslation();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [playlist.cover]);
  const artwork = tracks.filter(track => track.thumbnail).slice(0, 4);
  return <div className={`playlist-art ${className}`}>
    {playlist.cover && !failed ? <img src={playlist.cover} alt={t("Sampul {value0}", {
      value0: playlist.name
    })} className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} /> : artwork.length > 1 ? <div className="grid size-full grid-cols-2 grid-rows-2 gap-0.5">{Array.from({
        length: 4
      }, (_, index) => <Cover key={index} track={artwork[index % artwork.length]} className="size-full !rounded-none" />)}</div> : artwork.length === 1 ? <Cover track={artwork[0]} className="size-full !rounded-none" /> : <div className="relative grid size-full place-items-center"><img src="/artwork/studio.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-45" onError={event => {
        event.currentTarget.hidden = true;
      }} /><span className="relative grid size-[42%] place-items-center rounded-[28%] bg-surface/85 text-accent shadow-sm"><Music2 className="size-1/2" aria-hidden="true" /></span></div>}
  </div>;
}
