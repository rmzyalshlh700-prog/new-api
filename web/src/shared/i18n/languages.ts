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
export const INTERFACE_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
] as const

export type InterfaceLanguageCode =
  (typeof INTERFACE_LANGUAGE_OPTIONS)[number]['code']

export type TextDirection = 'ltr' | 'rtl'

/**
 * Interface languages written right-to-left. Register a new RTL language here
 * as well as in `INTERFACE_LANGUAGE_OPTIONS`; the document direction, Base UI
 * popups and the sidebar all follow from this set.
 */
const RTL_LANGUAGE_CODES: ReadonlySet<string> = new Set<InterfaceLanguageCode>([
  'ar',
])

export function normalizeInterfaceLanguage(value?: string | null): string {
  return matchInterfaceLanguage(value) ?? 'en'
}

/**
 * Match a stored or browser-reported locale against a shipped interface
 * language, or `null` when this project does not ship it.
 *
 * Regional variants such as `ar-EG` or `en-US` resolve to their base language.
 * Callers that must tell "English" apart from "not supported" (the startup
 * language resolver) need this; `normalizeInterfaceLanguage` collapses both to
 * `en`.
 */
export function matchInterfaceLanguage(
  value?: string | null
): InterfaceLanguageCode | null {
  if (!value) return null

  const normalized = value.trim().replaceAll('_', '-').toLowerCase()
  const [primary] = normalized.split('-')
  const match = INTERFACE_LANGUAGE_OPTIONS.find(
    (lang) => lang.code === normalized || lang.code === primary
  )
  return match?.code ?? null
}

/**
 * Text direction of an interface language code (or a browser locale such as
 * `ar-EG`). Unknown values fall back to English, which is left-to-right.
 */
export function getInterfaceLanguageDirection(
  value?: string | null
): TextDirection {
  return RTL_LANGUAGE_CODES.has(normalizeInterfaceLanguage(value))
    ? 'rtl'
    : 'ltr'
}

/**
 * Convert an interface language code (the values i18next uses, such as `zhCN` /
 * `zhTW`) into a valid BCP-47 locale tag that the `Intl.*` APIs accept.
 *
 * `new Intl.NumberFormat('zhCN')` throws `RangeError: Invalid language tag`, so
 * any locale derived from `i18n.language` / `i18n.resolvedLanguage` MUST be run
 * through this before it reaches an `Intl` constructor. Unknown values fall back
 * to `undefined`, which makes `Intl` use the runtime default locale.
 */
export function toIntlLocale(value?: string | null): string | undefined {
  if (!value) return undefined
  try {
    const [canonical] = Intl.getCanonicalLocales(value)
    if (!canonical) return undefined
    // Full-ICU browsers default Arabic to Arabic-Indic digits (١٢٣) while other
    // engines use Latin digits. Pin Latin digits so numbers match charts, ids,
    // code samples, and every other interface language.
    const isArabic = canonical === 'ar' || canonical.startsWith('ar-')
    if (isArabic && !canonical.includes('-u-')) return `${canonical}-u-nu-latn`
    return canonical
  } catch {
    return undefined
  }
}
