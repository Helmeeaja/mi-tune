import { publicProfile } from './profile.mjs'

export function visibility(value) {
  if (!['private','public'].includes(value)) throw Object.assign(new Error('Pilih private atau public.'),{status:400,code:'INVALID_VISIBILITY'})
  return value
}

export function createSharingService(db) {
  function tracks(ids) {
    return [...new Set(ids)].flatMap(id=>{
      const row=db.prepare('SELECT data FROM tracks WHERE id=?').get(id)
      if (!row) return []
      try {
        const item=JSON.parse(row.data)
        return item.id===id && item.type==='song' && item.source==='youtube-music'?[item]:[]
      }catch{return []}
    })
  }
  function summary(row,full=false) {
    const owner=db.prepare('SELECT * FROM users WHERE id=?').get(row.owner_id)
    const songs=tracks(JSON.parse(row.track_ids))
    return { id:row.id,name:row.name,visibility:'public',owner:publicProfile(owner),trackCount:songs.length,trackIds:songs.map(track=>track.id),tracks:full?songs:songs.slice(0,4),createdAt:row.created_at,cover:row.cover?`/api/playlists/${row.id}/cover`:null }
  }
  function search(query) {
    if(typeof query!=='string'||query.trim().length<2||query.length>160)throw Object.assign(new Error('Cari playlist dengan 2–160 karakter.'),{status:400,code:'INVALID_SEARCH'})
    const escaped=query.trim().replace(/[\\%_]/g,character=>`\\${character}`)
    const rows=db.prepare("SELECT p.* FROM playlists p JOIN users u ON u.id=p.owner_id WHERE p.visibility='public' AND (p.name LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\') ORDER BY p.created_at DESC LIMIT 20").all(`%${escaped}%`,`%${escaped}%`,`%${escaped}%`)
    return { playlists:rows.map(row=>summary(row)) }
  }
  function playlist(id) {
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id||''))throw Object.assign(new Error('Playlist tidak ditemukan.'),{status:404,code:'PLAYLIST_NOT_FOUND'})
    const row=db.prepare("SELECT * FROM playlists WHERE id=? AND visibility='public'").get(id)
    if(!row)throw Object.assign(new Error('Playlist tidak ditemukan.'),{status:404,code:'PLAYLIST_NOT_FOUND'})
    return { playlist:summary(row,true) }
  }
  function profile(username) {
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username||''))throw Object.assign(new Error('Profil tidak ditemukan.'),{status:404,code:'PROFILE_NOT_FOUND'})
    const row=db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(username)
    if(!row)throw Object.assign(new Error('Profil tidak ditemukan.'),{status:404,code:'PROFILE_NOT_FOUND'})
    const playlists=db.prepare("SELECT * FROM playlists WHERE owner_id=? AND visibility='public' ORDER BY created_at DESC").all(row.id).map(item=>summary(item))
    const favoritesPublic=row.likes_visibility==='public'
    const favoriteIds=favoritesPublic?db.prepare('SELECT track_id FROM favorites WHERE user_id=? ORDER BY rowid DESC').all(row.id).map(item=>item.track_id):[]
    return { user:publicProfile(row),playlists,favoritesPublic,favoriteTracks:tracks(favoriteIds) }
  }
  return { search,playlist,profile }
}
