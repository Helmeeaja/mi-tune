export function resolveRange(header, size) {
  if (!header) return null
  if (!Number.isSafeInteger(size) || size <= 0 || typeof header !== 'string') throw new RangeError('Invalid range')
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (!match[1] && !match[2])) throw new RangeError('Invalid range')
  let start
  let end
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new RangeError('Invalid range')
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) throw new RangeError('Invalid range')
    end = Math.min(end, size - 1)
  }
  return { start, end }
}
