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

export const OVERVIEW_RANGES = ['today', '24h', '7d', '30d'] as const

export type OverviewRangeId = (typeof OVERVIEW_RANGES)[number]

export const DEFAULT_OVERVIEW_RANGE: OverviewRangeId = '7d'

export const RANGE_STORAGE_KEY = 'admin-overview:range'

/** Resolved timestamp window (in seconds) plus the equivalent previous window. */
export interface RangeWindow {
  start: number
  end: number
  /** 'hour' buckets fill the sparkline for short windows, 'day' for long ones. */
  bucket: 'hour' | 'day'
  previousStart: number
  previousEnd: number
}

export function parseOverviewRange(value: unknown): OverviewRangeId {
  return OVERVIEW_RANGES.includes(value as OverviewRangeId)
    ? (value as OverviewRangeId)
    : DEFAULT_OVERVIEW_RANGE
}

const HOUR = 3600
const DAY = 24 * HOUR

function startOfLocalDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Resolve a preset into a concrete window. `end` always extends an hour past
 * now so the current hour bucket is included even when the export lags.
 */
export function resolveRangeWindow(
  range: OverviewRangeId,
  now: Date = new Date()
): RangeWindow {
  const nowSeconds = Math.floor(now.getTime() / 1000)
  const end = nowSeconds + HOUR

  if (range === 'today') {
    const start = Math.floor(startOfLocalDay(now).getTime() / 1000)
    return {
      start,
      end,
      bucket: 'hour',
      previousStart: start - DAY,
      previousEnd: start,
    }
  }

  if (range === '24h') {
    return {
      start: nowSeconds - DAY,
      end,
      bucket: 'hour',
      previousStart: nowSeconds - 2 * DAY,
      previousEnd: nowSeconds - DAY,
    }
  }

  const days = range === '7d' ? 7 : 30
  const start = nowSeconds - days * DAY
  return {
    start,
    end,
    bucket: 'day',
    previousStart: start - days * DAY,
    previousEnd: start,
  }
}

/** Percentage delta between two periods, or undefined when it is meaningless. */
export function deltaPercent(
  current: number,
  previous: number | undefined
): number | undefined {
  if (previous == null || previous <= 0) return undefined
  return ((current - previous) / previous) * 100
}

/** Verdict pip tone for a period-over-period delta: null hides the pip. */
export function deltaTone(
  delta: number | undefined
): 'success' | 'danger' | null {
  if (delta == null) return null
  return delta >= 0 ? 'success' : 'danger'
}

/** i18n key of a range preset's display label. */
export function rangeLabelKey(range: OverviewRangeId): string {
  switch (range) {
    case 'today':
      return 'Today'
    case '24h':
      return 'Last 24 hours'
    case '7d':
      return 'Last 7 days'
    case '30d':
      return 'Last 30 days'
  }
}
