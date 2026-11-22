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
export type LocalizedText = {
  en: string
  ar: string
  ru: string
}

export type BlogPost = {
  id: string
  slug: string
  date: string
  published: boolean
  title: LocalizedText
  summary: LocalizedText
  body: LocalizedText
}

export type BlogPostsResponse = {
  success: boolean
  message: string
  data?: BlogPost[]
}

export function emptyLocalizedText(): LocalizedText {
  return { en: '', ar: '', ru: '' }
}

/** Pick the reader's language, falling back to English when it is blank. */
export function resolveLocalizedText(
  text: LocalizedText | undefined,
  language: string
): string {
  if (!text) return ''
  const base = language.split('-')[0]
  if (base === 'ar' && text.ar?.trim()) return text.ar
  if (base === 'ru' && text.ru?.trim()) return text.ru
  return text.en ?? ''
}
