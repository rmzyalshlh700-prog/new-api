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
import { describe, expect, test } from 'vitest'

import { matchInterfaceLanguage, normalizeInterfaceLanguage } from './languages'

describe('matchInterfaceLanguage', () => {
  test('accepts supported codes and their regional variants', () => {
    expect(matchInterfaceLanguage('en')).toBe('en')
    expect(matchInterfaceLanguage('ru')).toBe('ru')
    expect(matchInterfaceLanguage('ar')).toBe('ar')
    expect(matchInterfaceLanguage('ar-EG')).toBe('ar')
    expect(matchInterfaceLanguage('ru_RU')).toBe('ru')
    expect(matchInterfaceLanguage('en-US')).toBe('en')
  })

  test('rejects locales this project does not ship', () => {
    expect(matchInterfaceLanguage('fr-FR')).toBeNull()
    expect(matchInterfaceLanguage('zh-CN')).toBeNull()
    expect(matchInterfaceLanguage('')).toBeNull()
    expect(matchInterfaceLanguage(undefined)).toBeNull()
  })
})

describe('normalizeInterfaceLanguage', () => {
  test('falls back to English for unsupported values', () => {
    expect(normalizeInterfaceLanguage('ar-EG')).toBe('ar')
    expect(normalizeInterfaceLanguage('fr-FR')).toBe('en')
    expect(normalizeInterfaceLanguage(undefined)).toBe('en')
  })
})
