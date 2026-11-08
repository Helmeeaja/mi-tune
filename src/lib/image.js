export async function prepareImage(file, { dimension = 960, maxBytes = 384 * 1024 } = {}) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Pilih foto JPG, PNG, atau WebP.')
  if (file.size > 8 * 1024 * 1024) throw new Error('File foto maksimal 8 MB sebelum diperkecil.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try { await image.decode() }
    catch { throw new Error('Gambar ini belum bisa dibaca. Pilih foto lain.') }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Ukuran gambar tidak valid.')
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight))
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Perangkatmu belum bisa menyiapkan gambar ini.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.86, 0.72, 0.58, 0.42]) {
      const result = canvas.toDataURL('image/webp', quality)
      if (atob(result.split(',')[1]).length <= maxBytes) return result
    }
    throw new Error('Foto masih terlalu besar. Pilih gambar yang lebih sederhana.')
  } finally { URL.revokeObjectURL(url) }
}
