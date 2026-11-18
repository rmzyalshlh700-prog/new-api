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
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The overview lays its sections out in reading order, one after another, so
 * the order in the component's JSX is the order on the page. Payment orders sit
 * directly below the platform metrics row, whose last tile is Net Profit.
 */
const OVERVIEW_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'index.tsx'
)

function sectionOrder(source: string): string[] {
  const markers = [
    '<OverviewStatCards',
    '<PlatformMetricsCards',
    '<PaymentOrdersWidget',
    '<PerformanceOverview',
    '<ActivityTrendPanel',
    '<RevenuePanel',
    '<TokenUsagePanel',
    '<TopModelsPanel',
  ]
  const positions = markers.map((marker) => ({
    marker,
    at: source.search(new RegExp(`${marker}\\b`)),
  }))
  for (const entry of positions) {
    expect(entry.at, `${entry.marker} is rendered`).toBeGreaterThan(-1)
  }
  return positions
    .sort((left, right) => left.at - right.at)
    .map((entry) => entry.marker)
}

describe('admin overview section order', () => {
  it('renders payment orders right below the net profit tile row', () => {
    const source = readFileSync(OVERVIEW_PATH, 'utf8')

    expect(sectionOrder(source)).toEqual([
      '<OverviewStatCards',
      '<PlatformMetricsCards',
      '<PaymentOrdersWidget',
      '<PerformanceOverview',
      '<ActivityTrendPanel',
      '<RevenuePanel',
      '<TokenUsagePanel',
      '<TopModelsPanel',
    ])
  })

  it('renders payment orders once, outside the two-panel grid', () => {
    const source = readFileSync(OVERVIEW_PATH, 'utf8')
    expect(source.match(/<PaymentOrdersWidget\b/g)?.length).toBe(1)
    expect(source).not.toContain('col-span-2 xl:col-span-1')
  })
})
