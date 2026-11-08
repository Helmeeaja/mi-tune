import { parseLrc } from './lyrics.mjs'

function timestamp(value) {
  const parts = value.replace(',','.').split(':').map(Number)
  if (parts.some(value=>!Number.isFinite(value)) || parts.length < 2 || parts.length > 3) return null
  const seconds = parts.pop()
  const minutes = parts.pop()
  const hours = parts.pop() || 0
  if (seconds < 0 || seconds >= 60 || minutes < 0 || minutes >= 60 || hours < 0) return null
  return hours * 3600 + minutes * 60 + seconds
}

export function parseTranscript(text, name = '') {
  if (typeof text !== 'string' || text.length > 400000 || !text.trim()) throw new Error('File transkrip kosong atau terlalu besar.')
  const value = text.replace(/\r/g,'')
  if (/\.lrc$/i.test(name)) {
    const cues = parseLrc(value)
    if (!cues.length) throw new Error('Timestamp LRC belum terbaca.')
    return { available:true,cues,text:cues.map(cue=>cue.text).join('\n'),imported:true,automatic:false }
  }
  const cues = []
  for (const block of value.split(/\n\s*\n/)) {
    const lines = block.split('\n')
    const index = lines.findIndex(line=>line.includes('-->'))
    if (index < 0) continue
    const match = /^\s*([\d:.,]+)\s*-->/.exec(lines[index])
    const time = match ? timestamp(match[1]) : null
    const content = lines.slice(index+1).join(' ').replace(/<[^>]*>/g,'').trim()
    if (time !== null && content && content.length < 4000) cues.push({ time,text:content })
  }
  if (/\.(?:vtt|srt)$/i.test(name) && !cues.length) throw new Error('Timestamp transkrip belum terbaca.')
  cues.sort((a,b)=>a.time-b.time)
  return { available:true,cues:cues.slice(0,10000),text:cues.length?cues.map(cue=>cue.text).join('\n'):value.trim(),imported:true,automatic:false }
}
