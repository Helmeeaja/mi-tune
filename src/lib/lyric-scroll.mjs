export function centeredScroll({ scrollTop, viewportTop, viewportHeight, lineTop, lineHeight, maxScroll }) {
  if (![scrollTop, viewportTop, viewportHeight, lineTop, lineHeight, maxScroll].every(Number.isFinite)) return 0
  return Math.max(0, Math.min(maxScroll, scrollTop + lineTop - viewportTop + lineHeight / 2 - viewportHeight / 2))
}

export function lyricPadding(viewportHeight, firstHeight, lastHeight) {
  return { top: Math.max(0, (viewportHeight - firstHeight) / 2), bottom: Math.max(0, (viewportHeight - lastHeight) / 2) }
}
