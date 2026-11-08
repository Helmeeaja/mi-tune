import { validatePlaylistCover } from './playlist-cover.mjs'

export const PROFILE_BODY_LIMIT = 600000

function invalid(message) {
  return Object.assign(new Error(message), { status: 400, code: 'INVALID_PROFILE' })
}

export function publicProfile(row) {
  return row ? { id: row.id, username: row.username, displayName: row.display_name, bio: row.bio || '', avatar: row.avatar || null, joinedAt: row.joined_at || null } : null
}

export function privateProfile(row) {
  return row ? { ...publicProfile(row), email: row.email || '', likesVisibility:row.likes_visibility==='public'?'public':'private',googleConnected:Boolean(row.google_sub),googleOnly:row.google_only===1 } : null
}

export function validateProfilePatch(value) {
  const keys = Object.keys(value)
  if (!keys.length || keys.some(key => !['displayName', 'username', 'bio', 'avatar', 'email','likesVisibility'].includes(key))) throw invalid('Isi bagian profil yang ingin kamu ubah.')
  const result = {}
  if(Object.hasOwn(value,'likesVisibility')) {
    if(!['private','public'].includes(value.likesVisibility))throw invalid('Pilih private atau public untuk lagu favorit.')
    result.likesVisibility=value.likesVisibility
  }
  if (Object.hasOwn(value, 'displayName')) {
    if (typeof value.displayName !== 'string' || !value.displayName.trim() || value.displayName.trim().length > 60 || /[\u0000-\u001f]/.test(value.displayName)) throw invalid('Nama tampilan maksimal 60 karakter.')
    result.displayName = value.displayName.trim()
  }
  if (Object.hasOwn(value, 'username')) {
    if (typeof value.username !== 'string' || !/^[A-Za-z0-9_]{3,24}$/.test(value.username)) throw invalid('Username 3–24 huruf, angka, atau underscore.')
    result.username = value.username
  }
  if (Object.hasOwn(value, 'bio')) {
    if (typeof value.bio !== 'string' || value.bio.length > 500 || value.bio.includes('\u0000')) throw invalid('Bio maksimal 500 karakter.')
    result.bio = value.bio.trim()
  }
  if (Object.hasOwn(value, 'email')) {
    if (typeof value.email !== 'string' || value.email.length > 254) throw invalid('Alamat email terlalu panjang.')
    const email = value.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('Periksa alamat emailmu.')
    result.email = email
  }
  if (Object.hasOwn(value, 'avatar')) {
    if (value.avatar !== null && (typeof value.avatar !== 'string' || !value.avatar.startsWith('data:image/') || value.avatar.length > 525000)) throw invalid('Gunakan foto JPG, PNG, atau WebP, maksimal 384 KB.')
    try { result.avatar = validatePlaylistCover(value.avatar) } catch { throw invalid('Foto belum bisa dibaca. Gunakan JPG, PNG, atau WebP.') }
    if (result.avatar && Buffer.from(result.avatar.split(',')[1], 'base64').length > 384 * 1024) throw invalid('Foto maksimal 384 KB setelah diperkecil.')
  }
  return result
}
