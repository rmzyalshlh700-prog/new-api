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
import { describe, expect, it } from 'vitest'

import ar from '../locales/ar.json'
import en from '../locales/en.json'
import ru from '../locales/ru.json'

const PUBLIC_CONTENT_KEYS = [
  'Documentation',
  'Integrations',
  'One API. Every model.',
  'Make your first request',
  'OpenAI-compatible',
  'Public Pages',
  'Blog Posts',
  'Base URL: https://astramux.com/v1',
]

const CYRILLIC = /[\u0400-\u04FF]/

describe('public content locales', () => {
  it('keeps exactly the same keys in en, ar and ru', () => {
    const enKeys = Object.keys(en.translation).sort()
    expect(Object.keys(ar.translation).sort()).toEqual(enKeys)
    expect(Object.keys(ru.translation).sort()).toEqual(enKeys)
  })

  it('translates every public content key instead of falling back', () => {
    for (const key of PUBLIC_CONTENT_KEYS) {
      expect(en.translation[key as keyof typeof en.translation]).toBeTruthy()
      expect(ar.translation[key as keyof typeof ar.translation]).toBeTruthy()
      expect(ru.translation[key as keyof typeof ru.translation]).toBeTruthy()
    }
  })

  it('contains no Cyrillic text in the Arabic bundle', () => {
    const offenders = Object.entries(ar.translation).filter(
      ([, value]) => typeof value === 'string' && CYRILLIC.test(value)
    )
    expect(offenders).toEqual([])
  })
})
