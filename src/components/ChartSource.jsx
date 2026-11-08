import { useTranslation } from '../lib/i18n.jsx'

export default function ChartSource({ feed, compact = false }) {
  const { t, locale } = useTranslation()
  if (compact || !feed?.tracks?.length) return null
  return <p className="text-xs leading-6 text-muted">{t('{count} lagu siap diputar', { count: feed.tracks.length.toLocaleString(locale) })}</p>
}
