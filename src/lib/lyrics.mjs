export function parseLrc(text) {
  if (typeof text !== 'string' || text.length > 100000) return []
  const offsetMatch = /\[offset:([+-]?\d+)\]/i.exec(text)
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0
  const lines = []
  for (const row of text.replace(/\r/g, '').split('\n')) {
    const timestamps = [...row.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!timestamps.length) continue
    const value = row.replace(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, '').trim()
    for (const timestamp of timestamps) {
      const seconds = Number(timestamp[2])
      if (seconds >= 60) continue
      const fraction = timestamp[3] ? Number(`0.${timestamp[3]}`) : 0
      const time = Math.max(0, Number(timestamp[1]) * 60 + seconds + fraction + offset)
      if (Number.isFinite(time)) lines.push({ time, text: value })
    }
    if (lines.length > 5000) return []
  }
  return lines.sort((a, b) => a.time - b.time)
}

export function getActiveLyricIndex(lines, time) {
  if (!Array.isArray(lines) || !lines.length || !Number.isFinite(time)) return -1
  let low = 0
  let high = lines.length - 1
  let answer = -1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (lines[middle].time <= time) {
      answer = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return answer
}
