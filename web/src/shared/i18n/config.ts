/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import {
  convertDetectedLanguage,
  normalizeInterfaceLanguage,
  type InterfaceLanguageCode,
} from './languages'
import en from './locales/en.json'

/**
 * Storage key for the interface language. It must stay `i18nextLng` because
 * the `LanguageDetector` caches manual choices under it and the pre-paint
 * direction script in `index.html` reads the same key.
 */
const LANGUAGE_STORAGE_KEY = 'i18nextLng'

export const SUPPORTED_LANGUAGES = [
  'en',
  'ru',
  'ar',
] as const

type LocaleBundle = { translation: Record<string, string> }
type LazyLocaleCode = Exclude<InterfaceLanguageCode, 'en'>

/**
 * Each non-fallback locale is its own chunk. Only English ships in the entry
 * bundle, so the 715 KB `ar.json` (185 KB gzipped) no longer delays first paint
 * for everybody who does not read Arabic.
 */
const LAZY_LOCALES: Record<
  LazyLocaleCode,
  () => Promise<{ default: LocaleBundle }>
> = {
  ru: () => import('./locales/ru.json'),
  ar: () => import('./locales/ar.json'),
}

const loadedLanguages = new Set<string>(['en'])

/**
 * Resolve a stored or browser-reported locale onto one of our interface codes.
 *
 * `normalizeInterfaceLanguage` falls back to English for anything it does not
 * know, so a non-English candidate is only accepted when it really is English.
 */
function matchSupportedLanguage(value: string): string | null {
  const converted = convertDetectedLanguage(value)
  const normalized = normalizeInterfaceLanguage(converted)
  const isEnglish = /^en\b/i.test(converted.trim().replaceAll('_', '-'))
  if (normalized === 'en' && !isEnglish) return null
  return normalized
}

/**
 * Resolve the `LanguageDetector`'s raw pick (stored choice first, then the
 * browser's `navigator` languages) onto an interface code we ship. Unknown
 * locales resolve to `null` so i18next falls back to English.
 */
function resolveDetectedLanguage(value?: string): string {
  if (!value) return 'en'
  return matchSupportedLanguage(value) ?? 'en'
}

async function loadBundle(code: string): Promise<LocaleBundle | undefined> {
  if (code === 'en') return undefined
  const loader = LAZY_LOCALES[code as LazyLocaleCode]
  if (!loader) return undefined
  const { default: bundle } = await loader()
  loadedLanguages.add(code)
  return bundle
}

/**
 * Load a locale chunk into the running i18next instance. Idempotent, and safe
 * to await before switching languages so the UI never renders raw keys.
 */
export async function ensureLanguageResources(
  language: string
): Promise<string> {
  const code = normalizeInterfaceLanguage(language)
  if (loadedLanguages.has(code)) return code

  const bundle = await loadBundle(code)
  if (bundle) i18n.addResourceBundle(code, 'translation', bundle.translation, true, true)
  return code
}

function persistInterfaceLanguage(code: string) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
  } catch {
    // Non-fatal: the language still applies for this page load.
  }
}

/**
 * Switch the interface language, loading its chunk first.
 * Use this instead of a bare `i18n.changeLanguage`.
 */
export async function changeInterfaceLanguage(
  language: string
): Promise<string> {
  const code = await ensureLanguageResources(language)
  persistInterfaceLanguage(code)
  await i18n.changeLanguage(code)
  return code
}

const initialLanguage = resolveDetectedLanguage(
  i18n.services.languageDetector?.detect() as string | undefined
)

/**
 * Resolves once the initial language chunk is loaded and i18next is ready.
 * `main.tsx` awaits it before rendering so no untranslated key is ever painted.
 */
export const i18nReady: Promise<void> = (async () => {
  const initialBundle = await loadBundle(initialLanguage)
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // Check the manually chosen language stored in localStorage first, then
      // the browser settings; unknown locales fall back to English.
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
      },
      resources: initialBundle
        ? { en, [initialLanguage]: initialBundle }
        : { en },
      supportedLngs: [...SUPPORTED_LANGUAGES],
      nonExplicitSupportedLngs: true,
      fallbackLng: 'en',
      load: 'currentOnly',
      nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
      debug: import.meta.env.DEV,
      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },
    })
  persistInterfaceLanguage(i18n.resolvedLanguage || initialLanguage)
})()

export default i18n
