import { interfaceTranslations } from './interface-translations.mjs'
import { featureTranslations } from './feature-translations.mjs'
import { mobileTranslations } from './mobile-translations.mjs'
import { copywriting } from './copywriting.mjs'

export const supportedLanguages = ['id', 'en']
export const locales = { id: 'id-ID', en: 'en-US' }
const idLabels = { 'Dawn': 'Fajar', 'After hours': 'Larut malam', 'Coast': 'Pesisir', 'Forest': 'Hutan', 'City': 'Kota', 'Mi Tune · make it yours': 'Mi Tune · ruangmu' }
const englishTranslations = { ...interfaceTranslations, ...featureTranslations, ...mobileTranslations, ...Object.fromEntries(Object.entries(copywriting).map(([key, value]) => [key, value[1]])) }
const indonesianTranslations = { ...idLabels, ...Object.fromEntries(Object.entries(copywriting).map(([key, value]) => [key, value[0]])) }
const patterns = Object.keys(englishTranslations).filter(key => /\{[A-Za-z][A-Za-z0-9_]*\}/.test(key)).map(key => {
  const names = []
  let source = '^'
  let cursor = 0
  for (const match of key.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) {
    source += key.slice(cursor, match.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(.+?)'
    names.push(match[1])
    cursor = match.index + match[0].length
  }
  source += key.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'
  return { expression: new RegExp(source), names, en: englishTranslations[key], id: indonesianTranslations[key] ?? key }
})

export function normalizeLanguage(value) { return supportedLanguages.includes(value) ? value : 'id' }

export function translate(language, text, values = {}) {
  if (text === null || text === undefined) return ''
  const original = String(text)
  const english = normalizeLanguage(language) === 'en'
  const prepared = original.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match,key) => Object.hasOwn(values,key) ? String(values[key]) : match)
  let translated = english ? englishTranslations[original] : indonesianTranslations[original]
  let replacements = values
  if (translated === undefined) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(prepared)
      if (!match) continue
      translated = english ? pattern.en : pattern.id
      replacements = { ...Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]])), ...values }
      break
    }
  }
  return (translated ?? original).replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key) => Object.hasOwn(replacements, key) ? String(replacements[key]) : match)
}

export function formatDate(language, value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locales[normalizeLanguage(language)], options) : ''
}
