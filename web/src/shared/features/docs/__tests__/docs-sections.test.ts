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

import {
  DOCS_DEFAULT_SECTION,
  DOCS_NAV,
  DOCS_SECTIONS,
  isDocsSectionId,
} from '../sections'

describe('docs navigation', () => {
  it('lists every section exactly once across the three groups', () => {
    const ids = DOCS_NAV.flatMap((group) => group.items.map((item) => item.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...DOCS_SECTIONS].sort())
  })

  it('keeps the three sidebar groups in reading order', () => {
    expect(DOCS_NAV.map((group) => group.id)).toEqual([
      'get-started',
      'core-concepts',
      'api-reference',
    ])
  })

  it('accepts known section ids and rejects anything else', () => {
    expect(isDocsSectionId(DOCS_DEFAULT_SECTION)).toBe(true)
    expect(isDocsSectionId('openai-compatible')).toBe(true)
    expect(isDocsSectionId('market-api')).toBe(false)
  })
})
