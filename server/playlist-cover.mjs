export const COVER_BODY_LIMIT = 900000
const MAX_IMAGE_BYTES = 512 * 1024
const bundledCovers = new Set(['/artwork/dawn.jpg', '/artwork/afterhours.jpg', '/artwork/coast.jpg', '/artwork/forest.jpg', '/artwork/studio.jpg', '/artwork/city.jpg'])

function invalid(message = 'Gunakan gambar JPG, PNG, WebP, atau sampul bawaan.') {
  return Object.assign(new Error(message), { status: 400, code: 'INVALID_PLAYLIST_COVER' })
}

export function validatePlaylistCover(value) {
  if (value === null) return null
  if (typeof value !== 'string') throw invalid()
  if (bundledCovers.has(value)) return value
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2].length % 4 || match[2].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw invalid('Sampul harus berupa gambar valid dan maksimal 512 KB setelah dioptimalkan.')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) throw invalid()
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
  const png = bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.subarray(12, 16).toString() === 'IHDR'
  const webp = bytes.length >= 20 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' && bytes.readUInt32LE(4) === bytes.length - 8 && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.subarray(12, 16).toString())
  if ((match[1] === 'jpeg' && !jpeg) || (match[1] === 'png' && !png) || (match[1] === 'webp' && !webp)) throw invalid('Isi file tidak cocok dengan format gambar.')
  return value
}
