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
import i18n, { type i18n as I18n } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import {
  matchInterfaceLanguage,
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

export const SUPPORTED_LANGUAGES = ['en', 'ru', 'ar'] as const

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

/** Locales already registered on an i18next instance, per instance. */
const loadedLanguages = new WeakMap<I18n, Set<string>>()

function loadedLanguageSet(instance: I18n): Set<string> {
  let loaded = loadedLanguages.get(instance)
  if (!loaded) {
    loaded = new Set(['en'])
    loadedLanguages.set(instance, loaded)
  }
  return loaded
}

async function loadBundle(code: string): Promise<LocaleBundle | undefined> {
  const loader = LAZY_LOCALES[code as LazyLocaleCode]
  if (!loader) return undefined
  const { default: bundle } = await loader()
  return bundle
}

/**
 * Load a locale chunk into the given i18next instance. Idempotent per instance,
 * and safe to await before switching languages so the UI never renders raw keys.
 */
export async function ensureLanguageResources(
  language: string,
  instance: I18n = i18n
): Promise<string> {
  const code = normalizeInterfaceLanguage(language)
  const loaded = loadedLanguageSet(instance)
  if (loaded.has(code)) return code

  const bundle = await loadBundle(code)
  if (bundle) {
    instance.addResourceBundle(
      code,
      'translation',
      bundle.translation,
      true,
      true
    )
  }
  loaded.add(code)
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

/**
 * Language to boot with: the manual choice stored under `i18nextLng` first,
 * then the browser's locales, then English.
 *
 * This cannot be delegated to `LanguageDetector.detect()`: the plugin does not
 * exist until `init()` has run, and by then i18next has already resolved (and
 * fallen back to English for) a language whose chunk was not passed as
 * `resources`. The chunk therefore has to be chosen before `init()`.
 */
export function resolveStartupLanguage(): string {
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in private mode; fall back to the browser.
  }
  const storedMatch = matchInterfaceLanguage(stored)
  if (storedMatch) return storedMatch

  let browserLocales: readonly string[] = []
  if (typeof navigator !== 'undefined') {
    browserLocales = navigator.languages?.length
      ? navigator.languages
      : [navigator.language]
  }
  for (const locale of browserLocales) {
    const match = matchInterfaceLanguage(locale)
    if (match) return match
  }
  return 'en'
}

/**
 * Boot i18next and settle on the interface language before the first render.
 */
export async function initializeI18n(instance: I18n = i18n): Promise<void> {
  instance.use(LanguageDetector).use(initReactI18next)

  const startupLanguage = resolveStartupLanguage()
  const startupBundle = await loadBundle(startupLanguage)

  await instance.init({
    // Resolved above so the matching locale chunk ships with the first render.
    // The detector still caches later manual choices under `i18nextLng`.
    lng: startupLanguage,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    resources: startupBundle
      ? { en, [startupLanguage]: startupBundle }
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

  if (startupBundle) loadedLanguageSet(instance).add(startupLanguage)

  const code = await ensureLanguageResources(instance.language, instance)
  if (instance.language !== code) {
    await instance.changeLanguage(code)
  }

  persistInterfaceLanguage(code)
}

/**
 * Resolves once the initial language chunk is loaded and i18next is ready.
 * `main.tsx` awaits it before rendering so no untranslated key is ever painted.
 */
export const i18nReady: Promise<void> = initializeI18n()

export default i18n
