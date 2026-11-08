import { weekdayGreetings } from './greetings-weekdays.mjs'
import { weekendGreetings } from './greetings-weekend.mjs'

export const periods = ['morning', 'afternoon', 'evening', 'night']
export const greetingPools = { ...weekdayGreetings, ...weekendGreetings }

const moods = {
  '1-morning': ['fresh', 'dawn', 'Senin pagi', 'Monday morning', 'Mulai minggu dengan musik.', 'Start the week with music.', 'Favorit lama atau lagu baru? Putar yang kamu suka.', 'An old favorite or something new? Play what you like.', 'upbeat acoustic pop songs', 'feel good indie songs'],
  '1-afternoon': ['focus', 'studio', 'Senin siang', 'Monday afternoon', 'Teman buat siang ini.', 'Your afternoon playlist.', 'Lanjut playlist tadi atau coba pilihan baru.', 'Keep that playlist going or try something new.', 'upbeat focus instrumental music', 'soft upbeat indie pop songs'],
  '1-evening': ['recover', 'coast', 'Senin sore', 'Monday evening', 'Mau lagu yang santai?', 'Something mellow?', 'Coba akustik, jazz, atau album favoritmu.', 'Try acoustic songs, jazz, or a favorite album.', 'relaxing acoustic soul songs', 'soft jazz evening music'],
  '1-night': ['rest', 'afterhours', 'Senin malam', 'Monday night', 'Masih mau satu lagu lagi?', 'Still up for one more?', 'Ada pilihan pelan kalau ingin lanjut mendengar.', 'Some quieter picks if you’re still listening.', 'calm piano instrumental music', 'soft ambient sleep music'],
  '2-morning': ['fresh', 'dawn', 'Selasa pagi', 'Tuesday morning', 'Pagi, mau dengar apa?', 'Morning. What’s on?', 'Mulai dari lagu yang kamu suka atau lihat chart terbaru.', 'Start with a favorite or check the latest chart.', 'feel good folk pop songs', 'light upbeat acoustic songs'],
  '2-afternoon': ['focus', 'studio', 'Selasa siang', 'Tuesday afternoon', 'Pilih lagu berikutnya.', 'Pick your next song.', 'Lanjutkan musiknya, atau coba satu episode podcast.', 'Keep the music on, or try a podcast episode.', 'chill instrumental funk music', 'upbeat mellow pop songs'],
  '2-evening': ['warm', 'coast', 'Selasa sore', 'Tuesday evening', 'Sore ini, putar favoritmu.', 'Put on an evening favorite.', 'Lagu lama juga enak didengar lagi.', 'An old favorite is always worth another listen.', 'warm acoustic folk songs', 'mellow soul evening songs'],
  '2-night': ['rest', 'afterhours', 'Selasa malam', 'Tuesday night', 'Lagu pelan buat malam ini.', 'Something quiet tonight.', 'Coba pilihan santai atau lanjut album yang tadi.', 'Try something mellow or finish that album.', 'peaceful acoustic guitar instrumental', 'soft intimate indie songs'],
  '3-morning': ['fresh', 'dawn', 'Rabu pagi', 'Wednesday morning', 'Tengah minggu, coba yang baru.', 'Midweek. Try something new.', 'Lagu baru atau artis yang belum pernah kamu dengar.', 'A new song or an artist you haven’t heard yet.', 'bright indie folk songs', 'optimistic alternative pop songs'],
  '3-afternoon': ['focus', 'studio', 'Rabu siang', 'Wednesday afternoon', 'Lanjutkan playlist-mu.', 'Keep your playlist going.', 'Tambah lagu baru kalau antreannya mulai habis.', 'Add a new song if your queue is running low.', 'instrumental jazz funk focus', 'mellow upbeat indie songs'],
  '3-evening': ['recover', 'forest', 'Rabu sore', 'Wednesday evening', 'Musik buat sore ini.', 'Music for this evening.', 'Pilih akustik, jazz, atau tetap dengar pop.', 'Go acoustic, try jazz, or stick with pop.', 'relaxing neo soul songs', 'soft acoustic evening songs'],
  '3-night': ['rest', 'afterhours', 'Rabu malam', 'Wednesday night', 'Satu album sebelum selesai?', 'One more album?', 'Putar favoritmu atau cari album yang belum dicoba.', 'Play a favorite or find an album you haven’t tried.', 'peaceful piano ambient music', 'quiet indie folk night songs'],
  '4-morning': ['fresh', 'dawn', 'Kamis pagi', 'Thursday morning', 'Buka hari dengan lagu pilihanmu.', 'Start with your own pick.', 'Lihat chart kalau belum tahu mau putar apa.', 'Check the chart if you’re not sure what to play.', 'upbeat indie pop morning songs', 'feel good acoustic soul songs'],
  '4-afternoon': ['focus', 'city', 'Kamis siang', 'Thursday afternoon', 'Mau coba lagu lain?', 'Fancy a different song?', 'Ada pilihan baru di luar playlist favoritmu.', 'Find something new beyond your usual playlist.', 'upbeat soul funk songs', 'chill upbeat pop songs'],
  '4-evening': ['warm', 'coast', 'Kamis sore', 'Thursday evening', 'Lagu santai buat sore ini.', 'A mellow evening mix.', 'Coba album akustik atau penyanyi favoritmu.', 'Try an acoustic album or a favorite artist.', 'warm jazz soul songs', 'relaxed acoustic pop songs'],
  '4-night': ['rest', 'afterhours', 'Kamis malam', 'Thursday night', 'Lanjut musik atau podcast?', 'More music or a podcast?', 'Pilihan malam ini nggak harus sama dengan tadi.', 'Tonight’s pick doesn’t have to be the same as before.', 'soft piano night instrumental', 'calm dreamy folk songs'],
  '5-morning': ['lift', 'dawn', 'Jumat pagi', 'Friday morning', 'Lagu pertama buat Jumat.', 'Your first Friday song.', 'Mulai dari favoritmu, lalu coba yang lagi populer.', 'Start with a favorite, then try what’s popular.', 'feel good upbeat pop songs', 'sunny indie soul songs'],
  '5-afternoon': ['celebrate', 'city', 'Jumat siang', 'Friday afternoon', 'Siapkan playlist akhir pekan.', 'Start your weekend playlist.', 'Tambah lagu yang ingin kamu putar lagi nanti.', 'Add the songs you want to hear again later.', 'feel good funk pop songs', 'upbeat weekend indie songs'],
  '5-evening': ['celebrate', 'coast', 'Jumat sore', 'Friday evening', 'Akhir pekan dimulai.', 'The weekend starts here.', 'Musik santai atau upbeat, kamu yang pilih.', 'Mellow or upbeat, it’s your pick.', 'friday evening soul funk songs', 'upbeat mellow disco songs'],
  '5-night': ['celebrate', 'city', 'Jumat malam', 'Friday night', 'Satu lagu lagi?', 'One more song?', 'Lanjutkan playlist akhir pekan atau cari lagu baru.', 'Keep the weekend playlist on or find a new track.', 'funk dance pop songs', 'disco feel good songs'],
  '6-morning': ['leisure', 'dawn', 'Sabtu pagi', 'Saturday morning', 'Mau lagu santai pagi ini?', 'A mellow morning?', 'Coba akustik, indie, atau album yang kamu suka.', 'Try acoustic songs, indie, or an album you love.', 'relaxed acoustic weekend songs', 'feel good mellow indie songs'],
  '6-afternoon': ['explore', 'forest', 'Sabtu siang', 'Saturday afternoon', 'Cari favorit berikutnya.', 'Find your next favorite.', 'Coba artis baru atau podcast yang belum pernah didengar.', 'Try a new artist or a podcast you haven’t heard.', 'feel good indie folk songs', 'relaxed alternative soul songs'],
  '6-evening': ['warm', 'coast', 'Sabtu sore', 'Saturday evening', 'Putar yang kamu suka.', 'Play what you love.', 'Favorit lama atau penemuan baru, keduanya ada di sini.', 'Old favorites and new finds are both here.', 'cozy jazz acoustic songs', 'warm mellow soul songs'],
  '6-night': ['leisure', 'afterhours', 'Sabtu malam', 'Saturday night', 'Masih ingin mendengar?', 'Still listening?', 'Tambah satu lagu ke antrean atau lanjut albumnya.', 'Add a song to the queue or keep the album going.', 'chill rnb soul night songs', 'relaxed jazzy indie songs'],
  '0-morning': ['leisure', 'dawn', 'Minggu pagi', 'Sunday morning', 'Pagi ini, santai dulu.', 'An easy Sunday morning.', 'Lagu santai buat didengar sambil menikmati pagi.', 'Mellow songs for your Sunday morning.', 'soft sunday acoustic songs', 'calm morning jazz instrumental'],
  '0-afternoon': ['leisure', 'coast', 'Minggu siang', 'Sunday afternoon', 'Musik buat sisa akhir pekan.', 'Your Sunday afternoon mix.', 'Lanjut playlist favorit atau coba satu lagu baru.', 'Keep a favorite playlist on or try a new song.', 'relaxed sunny indie folk songs', 'mellow sunday jazz songs'],
  '0-evening': ['reflect', 'forest', 'Minggu sore', 'Sunday evening', 'Favorit buat menutup akhir pekan.', 'Favorites to end the weekend.', 'Pilih album yang kamu suka atau dengar episode terbaru.', 'Pick an album you love or hear the latest episode.', 'reflective acoustic folk songs', 'soft soulful evening music'],
  '0-night': ['rest', 'afterhours', 'Minggu malam', 'Sunday night', 'Lagu terakhir buat minggu ini?', 'Last song of the week?', 'Putar satu lagi, atau simpan pilihanmu buat besok.', 'Play one more, or save your pick for tomorrow.', 'soft piano peaceful instrumental', 'calm acoustic folk night songs']
}

export function getListeningContext(date = new Date()) {
  if (!date || typeof date.getTime !== 'function' || !Number.isFinite(date.getTime())) throw new TypeError('A valid local date is required')
  const hour = date.getHours()
  const period = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night'
  const day = date.getDay()
  const key = `${day}-${period}`
  const [mood, artwork, tagId, tagEn, titleId, titleEn, descriptionId, descriptionEn, ...queries] = moods[key]
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}:${period}`
  return { key, stamp, day, period, mood, artwork: `/artwork/${artwork}.jpg`, tag: { id: tagId, en: tagEn }, title: { id: titleId, en: titleEn }, description: { id: descriptionId, en: descriptionEn }, queries }
}

const memory = new Map()
const deviceMemory = new WeakMap()
const storageKey = 'mi-tune-greetings:v1'

function deviceStorage() {
  try { return globalThis.localStorage } catch { return undefined }
}

function validBag(value, length) {
  return value && Array.isArray(value.remaining) && Array.isArray(value.recent) && value.remaining.length <= length && value.recent.length <= 3 && new Set(value.remaining).size === value.remaining.length && [...value.remaining, ...value.recent].every(index => Number.isInteger(index) && index >= 0 && index < length)
}

export function chooseGreeting(context, { storage = deviceStorage(), random = Math.random } = {}) {
  const pool = greetingPools[context?.key]
  if (!pool?.length) throw new TypeError('A known listening context is required')
  let saved = {}
  try {
    const data = JSON.parse(storage?.getItem(storageKey) || '{}')
    if (data && typeof data === 'object' && !Array.isArray(data)) for (const [key, value] of Object.entries(data)) if (greetingPools[key] && validBag(value, greetingPools[key].length)) saved[key] = value
  } catch { }
  let session = memory
  if (storage && (typeof storage === 'object' || typeof storage === 'function')) {
    if (!deviceMemory.has(storage)) deviceMemory.set(storage, new Map())
    session = deviceMemory.get(storage)
  }
  let bag = saved[context.key] || session.get(context.key)
  if (!validBag(bag, pool.length)) bag = { remaining: [], recent: [] }
  if (!bag.remaining.length) {
    bag.remaining = pool.map((_, index) => index)
    for (let index = bag.remaining.length - 1; index > 0; index -= 1) {
      const value = Number(random())
      const fraction = Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0
      const target = Math.floor(fraction * (index + 1))
      ;[bag.remaining[index], bag.remaining[target]] = [bag.remaining[target], bag.remaining[index]]
    }
  }
  const next = bag.remaining.findIndex(index => !bag.recent.includes(index))
  const index = bag.remaining.splice(next < 0 ? 0 : next, 1)[0]
  bag.recent = [...bag.recent, index].slice(-3)
  session.set(context.key, bag)
  saved[context.key] = bag
  try { storage?.setItem(storageKey, JSON.stringify(saved)) } catch { }
  return { ...pool[index], index }
}
