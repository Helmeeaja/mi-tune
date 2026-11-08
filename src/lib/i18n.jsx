import { createContext, useContext, useMemo } from 'react'
import { normalizeLanguage, translate, locales, formatDate } from './i18n.mjs'

const LanguageContext = createContext({ language: 'id', locale: 'id-ID', t: (text, values) => translate('id', text, values), date: (value, options) => formatDate('id', value, options) })

export function LanguageProvider({ language, children }) {
  const selected = normalizeLanguage(language)
  const value = useMemo(() => ({ language: selected, locale: locales[selected], t: (text, values) => translate(selected, text, values), date: (input, options) => formatDate(selected, input, options) }), [selected])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  return useContext(LanguageContext)
}
