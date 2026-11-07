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
  buildBucketSeries,
  buildDailyActivity,
  buildDailyRevenue,
  buildHourlyActiveUsers,
  buildModelUsage,
  buildTodayTokenSeries,
  countActiveUsers,
  sumUsage,
  sumUsageSince,
} from '../lib/aggregate'
import {
  deltaPercent,
  deltaTone,
  parseOverviewRange,
  rangeLabelKey,
  resolveRangeWindow,
} from '../lib/ranges'
import type { OverviewQuotaRow, OverviewUserRow } from '../types'

function timestampDaysAgo(days: number, hour = 12): number {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return Math.floor(date.getTime() / 1000)
}

describe('admin overview aggregation', () => {
  it('keeps quota, token and request sums as exact integers', () => {
    const rows: OverviewQuotaRow[] = [
      { created_at: 1, quota: 1_500_000, token_used: 1200, count: 3 },
      { created_at: 2, quota: 500, token_used: 0, count: 1 },
      { created_at: 3, quota: Number.NaN, token_used: -4, count: 2 },
    ]

    expect(sumUsage(rows)).toEqual({
      quota: 1_500_500,
      tokens: 1200,
      requests: 6,
    })
  })

  it('filters rows before the requested start timestamp', () => {
    const rows: OverviewQuotaRow[] = [
      { created_at: 100, quota: 10, token_used: 1, count: 1 },
      { created_at: 200, quota: 20, token_used: 2, count: 2 },
      { created_at: 300, quota: 30, token_used: 3, count: 3 },
    ]

    expect(sumUsageSince(rows, 200)).toEqual({
      quota: 50,
      tokens: 5,
      requests: 5,
    })
  })

  it('buckets revenue into the last 30 local days without losing precision', () => {
    const rows: OverviewQuotaRow[] = [
      { created_at: timestampDaysAgo(0), quota: 500_000 },
      { created_at: timestampDaysAgo(0), quota: 250_000 },
      { created_at: timestampDaysAgo(1), quota: 100 },
      { created_at: timestampDaysAgo(40), quota: 999 },
    ]

    const points = buildDailyRevenue(rows, 30)

    expect(points).toHaveLength(30)
    expect(points.at(-1)?.quota).toBe(750_000)
    expect(points.at(-2)?.quota).toBe(100)
    expect(points.every((point) => Number.isInteger(point.quota))).toBe(true)
  })

  it('merges rows per model and orders them by token usage', () => {
    const rows: OverviewQuotaRow[] = [
      {
        created_at: timestampDaysAgo(0),
        model_name: 'gpt-4o',
        quota: 100,
        token_used: 10,
        count: 1,
      },
      {
        created_at: timestampDaysAgo(0),
        model_name: 'gpt-4o',
        quota: 100,
        token_used: 20,
        count: 2,
      },
      {
        created_at: timestampDaysAgo(0),
        model_name: 'claude',
        quota: 300,
        token_used: 40,
        count: 4,
      },
    ]

    expect(buildModelUsage(rows)).toEqual([
      { model: 'claude', quota: 300, tokens: 40, requests: 4 },
      { model: 'gpt-4o', quota: 200, tokens: 30, requests: 3 },
    ])
  })

  it('groups today token usage per hour with top models and an other series', () => {
    const todayStart = timestampDaysAgo(0, 0)
    const rows: OverviewQuotaRow[] = Array.from({ length: 6 }, (_, index) => ({
      created_at: timestampDaysAgo(0, 9),
      model_name: `model-${index}`,
      token_used: 100 - index * 10,
      count: 1,
      quota: 10,
    }))

    const result = buildTodayTokenSeries(rows, todayStart, 23, 5)

    expect(result.series).toHaveLength(6)
    expect(result.series.at(-1)?.model).toBe('Other')
    expect(result.points).toHaveLength(24)
    expect(result.points[9]?.label).toBe('09:00')
    expect(result.points[9]?.total).toBe(450)
    expect(result.points[9]?.values.other).toBe(50)
  })

  it('counts distinct active users and their hourly presence', () => {
    const now = new Date(2026, 10, 6, 12, 30, 0)
    const currentHourStart = new Date(now)
    currentHourStart.setMinutes(0, 0, 0)
    const previousHour = Math.floor(currentHourStart.getTime() / 1000) - 3600
    const rows: OverviewUserRow[] = [
      { username: 'alice', created_at: previousHour },
      { username: 'alice', created_at: previousHour },
      { username: 'bob', created_at: previousHour },
      { username: '   ', created_at: previousHour },
    ]

    expect(countActiveUsers(rows)).toBe(2)

    const points = buildHourlyActiveUsers(rows, now)
    expect(points).toHaveLength(24)
    expect(points[22]).toEqual({ label: '11:00', activeUsers: 2 })
    expect(points[23]).toEqual({ label: '12:00', activeUsers: 0 })
  })

  it('rejects unknown stored ranges and keeps the default', () => {
    expect(parseOverviewRange('30d')).toBe('30d')
    expect(parseOverviewRange('bogus')).toBe('7d')
    expect(parseOverviewRange(undefined)).toBe('7d')
  })

  it('resolves preset windows with an equally sized previous window', () => {
    const now = new Date(2026, 10, 7, 12, 0, 0)
    const window = resolveRangeWindow('7d', now)

    expect(window.end - window.start).toBe(7 * 24 * 3600 + 3600)
    expect(window.previousEnd).toBe(window.start)
    expect(window.start - window.previousStart).toBe(7 * 24 * 3600)
    expect(window.bucket).toBe('day')
  })

  it('uses hour buckets for today and day buckets for long windows', () => {
    const now = new Date(2026, 10, 7, 12, 0, 0)
    expect(resolveRangeWindow('today', now).bucket).toBe('hour')
    expect(resolveRangeWindow('24h', now).bucket).toBe('hour')
    expect(resolveRangeWindow('30d', now).bucket).toBe('day')
  })

  it('buckets window rows into consecutive hours with zero-filled gaps', () => {
    const now = new Date(2026, 10, 7, 3, 0, 0)
    const window = resolveRangeWindow('today', now)
    const hour = (h: number) =>
      Math.floor(new Date(2026, 10, 7, h, 0, 0).getTime() / 1000)
    const rows: OverviewQuotaRow[] = [
      { created_at: hour(1), quota: 100, token_used: 10, count: 1 },
      { created_at: hour(1), quota: 50, token_used: 5, count: 2 },
      { created_at: hour(3), quota: 7, token_used: 1, count: 1 },
      { created_at: hour(4), quota: 9, token_used: 2, count: 1 },
    ]

    const points = buildBucketSeries(rows, window, now)

    expect(points).toHaveLength(4)
    expect(points[0]).toEqual({
      label: '00:00',
      quota: 0,
      tokens: 0,
      requests: 0,
    })
    expect(points[1]).toEqual({
      label: '01:00',
      quota: 150,
      tokens: 15,
      requests: 3,
    })
    expect(points[3].quota).toBe(7)
    expect(points.every((point) => Number.isInteger(point.quota))).toBe(true)
  })

  it('buckets window rows into consecutive days for long ranges', () => {
    const now = new Date(2026, 10, 7, 12, 0, 0)
    const window = resolveRangeWindow('7d', now)
    const day = (daysAgo: number) =>
      Math.floor(new Date(2026, 10, 7 - daysAgo, 12, 0, 0).getTime() / 1000)
    const rows: OverviewQuotaRow[] = [
      { created_at: day(0), quota: 10, token_used: 1, count: 1 },
      { created_at: day(6), quota: 20, token_used: 2, count: 1 },
      { created_at: day(9), quota: 999, token_used: 9, count: 1 },
    ]

    const points = buildBucketSeries(rows, window, now)

    expect(points).toHaveLength(8)
    expect(points[1].quota).toBe(20)
    expect(points.at(-1)?.quota).toBe(10)
  })

  it('builds one zero-filled activity entry per day for the heatmap', () => {
    const now = new Date(2026, 10, 7, 12, 0, 0)
    const day = (daysAgo: number, hour = 12) =>
      Math.floor(new Date(2026, 10, 7 - daysAgo, hour, 0, 0).getTime() / 1000)
    const rows: OverviewQuotaRow[] = [
      { created_at: day(0), quota: 100, token_used: 500, count: 2 },
      { created_at: day(1), quota: 40, token_used: 0, count: 0 },
    ]

    const points = buildDailyActivity(rows, 14, now)

    expect(points).toHaveLength(14)
    expect(points.at(-1)).toEqual({
      day: '2026-11-07',
      tokens: 500,
      requests: 2,
      quota: 100,
    })
    expect(points.at(-2)?.tokens).toBe(0)
    expect(points[0].day).toBe('2026-10-25')
  })

  it('computes delta percentages and verdict tones for the tiles', () => {
    expect(deltaPercent(150, 100)).toBe(50)
    expect(deltaPercent(50, 100)).toBe(-50)
    expect(deltaPercent(100, 0)).toBeUndefined()
    expect(deltaPercent(100, undefined)).toBeUndefined()

    expect(deltaTone(50)).toBe('success')
    expect(deltaTone(-1)).toBe('danger')
    expect(deltaTone(undefined)).toBeNull()
  })

  it('maps every range preset to a label key', () => {
    expect(rangeLabelKey('today')).toBe('Today')
    expect(rangeLabelKey('24h')).toBe('Last 24 hours')
    expect(rangeLabelKey('7d')).toBe('Last 7 days')
    expect(rangeLabelKey('30d')).toBe('Last 30 days')
  })
})
