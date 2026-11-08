import { useTranslation } from "../lib/i18n.jsx";
import { Search, Check, X, UserMinus, UserPlus, UsersRound, Clock3, LoaderCircle, Send } from 'lucide-react';
import Avatar from '../components/Avatar.jsx';
import GuestPrompt from '../components/GuestPrompt.jsx';
export default function FriendsPage({
  user,
  friends,
  query,
  results,
  busy,
  error,
  searched,
  actionBusy,
  onQuery,
  onSearch,
  onSend,
  onRespond,
  onCancel,
  onRemove,
  onAuth,
  onRegister,
  onProfile
}) {
  const {
    t,
    locale
  } = useTranslation();
  if (!user) return <GuestPrompt feature="friends" onLogin={onAuth} onRegister={onRegister} />;
  const acting = Boolean(actionBusy);
  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-3">{t("Ada yang seirama")}</p><h1 className="page-heading">{t("Teman musikmu.")}</h1><p className="muted-copy mt-3">{t("Cari username, kirim undangan, lalu tunggu jawaban mereka.")}</p></div><span className="rounded-full bg-sage/65 px-4 py-2 text-[11px] font-bold text-muted">{friends.friends.length} {t("teman ·")} {friends.incoming.length} {t("undangan masuk")}</span></div>
    {error && <p role="alert" className="notice">{t(error)}</p>}
    <section className="clay-panel p-5 sm:p-7"><h2 className="section-heading">{t("Cari seseorang")}</h2><p className="mt-2 text-xs leading-6 text-muted">{t("Username atau nama tampilan. Minimal dua huruf.")}</p><form onSubmit={onSearch} className="mobile-friend-search mt-5 flex gap-2" aria-busy={busy}><label className="relative min-w-0 flex-1"><span className="sr-only">{t("Cari username teman")}</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={17} /><input type="text" inputMode="search" enterKeyHint="search" autoComplete="off" autoCapitalize="none" spellCheck={false} value={query} maxLength={60} onChange={event => onQuery(event.target.value)} placeholder={t("Username atau nama teman…")} className="clay-input !pl-11" /></label><button type="submit" disabled={busy} className="clay-button clay-primary !px-4">{busy ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : t("Cari")}</button></form>
      {searched && !busy && !error && !results.length && <p role="status" className="mt-5 rounded-[18px] bg-canvas p-4 text-xs leading-6 text-muted">{t("Belum ada pengguna yang cocok. Coba username atau nama lain.")}</p>}
      {searched && results.length > 0 && <div className="mt-5 space-y-3">{results.map(person => {
          const connected = friends.friends.some(friend => friend.id === person.id);
          const outgoing = friends.outgoing.find(request => request.user.id === person.id);
          const incoming = friends.incoming.find(request => request.user.id === person.id);
          return <div key={person.id} className="friend-row rounded-[20px] bg-canvas p-3 sm:p-4"><Avatar person={person} /><Person onProfile={onProfile} person={person} detail={connected ? t("Sudah berteman") : outgoing ? t("Undangan terkirim · menunggu jawaban") : incoming ? t("Mengirim undangan kepadamu") : ''} />{connected ? <span className="friend-status"><Check size={14} />{t("Teman")}</span> : outgoing ? <span className="friend-status"><Clock3 size={14} />{t("Menunggu")}</span> : incoming ? <button type="button" disabled={acting} onClick={() => onRespond(incoming.id, 'accept')} className="clay-button clay-primary !px-3 !text-xs">{actionBusy === incoming.id ? <LoaderCircle size={14} className="motion-safe:animate-spin" /> : <Check size={14} />}{t("Terima")}</button> : <button type="button" disabled={acting} onClick={() => onSend(person.id)} className="clay-button !px-3 !text-xs">{actionBusy === person.id ? <LoaderCircle size={14} className="motion-safe:animate-spin" /> : <UserPlus size={14} />}{t("Tambah")}</button>}</div>;
        })}</div>}
    </section>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="clay-panel p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[14px] bg-sage/70 text-ink"><UsersRound size={18} /></span><div><h2 className="text-lg font-extrabold tracking-tight">{t("Permintaan masuk")}</h2><p className="mt-1 text-[10px] text-muted">{t("Kamu yang menentukan.")}</p></div></div>{friends.incoming.length ? <div className="space-y-3">{friends.incoming.map(request => <div key={request.id} className="friend-row rounded-[20px] bg-sage/35 p-3"><Avatar person={request.user} /><Person onProfile={onProfile} person={request.user} /><div className="flex gap-1"><button type="button" disabled={acting} aria-label={t("Terima {value0}", {
                value0: request.user.username
              })} onClick={() => onRespond(request.id, 'accept')} className="icon-button clay-primary">{actionBusy === request.id ? <LoaderCircle size={17} className="motion-safe:animate-spin" /> : <Check size={18} />}</button><button type="button" disabled={acting} aria-label={t("Tolak {value0}", {
                value0: request.user.username
              })} onClick={() => onRespond(request.id, 'reject')} className="icon-button"><X size={18} /></button></div></div>)}</div> : <p className="rounded-[18px] bg-canvas p-4 text-xs leading-6 text-muted">{t("Belum ada undangan masuk. Kalau ada, kamu bisa menerima atau menolaknya di sini.")}</p>}</section>
      <section className="clay-panel p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[14px] bg-accent-light/70 text-accent"><Send size={17} /></span><div><h2 className="text-lg font-extrabold tracking-tight">{t("Menunggu jawaban")}</h2><p className="mt-1 text-[10px] text-muted">{t("Undangan yang kamu kirim.")}</p></div></div>{friends.outgoing.length ? <div className="space-y-3">{friends.outgoing.map(request => <div key={request.id} className="friend-row rounded-[20px] bg-canvas p-3"><Avatar person={request.user} /><Person onProfile={onProfile} person={request.user} detail={t("Menunggu persetujuan")} /><button type="button" disabled={acting} aria-label={t("Batalkan permintaan ke {value0}", {
              value0: request.user.username
            })} onClick={() => onCancel(request.id)} className="clay-button !px-3 !text-xs">{actionBusy === request.id ? <LoaderCircle size={14} className="motion-safe:animate-spin" /> : <X size={14} />}{t("Batal")}</button></div>)}</div> : <p className="rounded-[18px] bg-canvas p-4 text-xs leading-6 text-muted">{t("Belum ada undangan yang menunggu. Cari seseorang untuk mulai terhubung.")}</p>}</section>
    </div>
    <section className="clay-panel p-5 sm:p-7"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="section-heading">{t("Yang sudah terhubung.")}</h2><span className="text-[11px] text-muted">{friends.friends.length} {t("teman")}</span></div>{friends.friends.length ? <div className="grid gap-3 md:grid-cols-2">{friends.friends.map(person => <div key={person.id} className="friend-row rounded-[20px] bg-canvas p-4"><Avatar person={person} /><Person onProfile={onProfile} person={person} detail={person.bio} /><button type="button" disabled={acting} aria-label={t("Hapus teman {value0}", {
            value0: person.username
          })} onClick={() => onRemove(person)} className="icon-button"><UserMinus size={17} /></button></div>)}</div> : <div className="empty-state !py-9"><span className="empty-icon"><UsersRound size={27} /></span><h3 className="text-lg font-bold">{t("Ruang untuk teman baru.")}</h3><p className="max-w-sm text-xs leading-6 text-muted">{t("Pertemanan muncul setelah undangan diterima. Mengirim permintaan saja belum membuat kalian terhubung.")}</p></div>}</section>
  </div>;
}
function Person({
  person,
  detail,
  onProfile
}) {
  const {
    t,
    locale
  } = useTranslation();
  return <div className="min-w-0 flex-1"><a href={`/u/${person.username}`} onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onProfile?.(person)}} className="block min-h-11"><span className="block truncate text-sm font-bold hover:underline">{person.displayName}</span><span className="mt-1 block truncate text-[11px] text-muted">{t("@")}{person.username}</span></a>{detail && <p className="mt-1.5 truncate text-[10px] leading-5 text-muted">{detail}</p>}</div>;
}
