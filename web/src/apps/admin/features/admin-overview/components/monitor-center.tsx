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
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Activity, AlertTriangle, Coins, Cpu, Users, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatCard } from '@/apps/client/features/dashboard/components/ui/stat-card'
import { HealthRing } from '@/shared/components/console/health-ring'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import {
  formatCompactNumber,
  formatDashboardQuota,
  formatInteger,
} from '@/shared/lib/format'
import { requireServerSuccess } from '@/shared/lib/server-error-message'
import { cn } from '@/shared/lib/utils'

import { getAdminLiveStat, getAdminLogStat } from '../api'
import { LIVE_REFRESH_MS } from '../constants'
import type { DashboardMetrics, OverviewQuotaRow } from '../types'

/**
 * Reporting windows of the Monitor Center.
 *
 * `hour` and `day` buckets come from the hourly quota aggregate the backend
 * already serves; the two sub-hour windows have no finer server-side bucket,
 * so they read exact window totals from the live-stat endpoint instead of
 * interpolating a series that does not exist.
 */
const RANGES = [
  { id: '15m', seconds: 15 * 60, bucket: 'live' },
  { id: '1h', seconds: 60 * 60, bucket: 'live' },
  { id: '6h', seconds: 6 * 60 * 60, bucket: 'hour' },
  { id: '24h', seconds: 24 * 60 * 60, bucket: 'hour' },
  { id: '7d', seconds: 7 * 24 * 60 * 60, bucket: 'day' },
  { id: '30d', seconds: 30 * 24 * 60 * 60, bucket: 'day' },
] as const

type RangeOption = (typeof RANGES)[number]
type RangeId = RangeOption['id']

interface TrafficBucket {
  label: string
  requests: number
  tokens: number
  cost: number
}

function count(value: number | undefined): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0
}

/**
 * Fold hourly quota rows into the buckets of the selected window. Values stay
 * exact integers in quota units; nothing is averaged or estimated.
 */
function buildTrafficBuckets(
  rows: readonly OverviewQuotaRow[],
  range: RangeOption,
  now: Date
): TrafficBucket[] {
  if (range.bucket === 'live') return []
  const size = range.bucket === 'hour' ? 3600 : 86400
  const total = Math.round(range.seconds / size)
  const end = Math.ceil(now.getTime() / 1000 / size) * size
  const start = end - total * size
  const buckets: TrafficBucket[] = Array.from({ length: total }, (_, index) => {
    const timestamp = (start + index * size) * 1000
    return {
      label:
        range.bucket === 'hour'
          ? dayjs(timestamp).format('HH:00')
          : dayjs(timestamp).format('MM-DD'),
      requests: 0,
      tokens: 0,
      cost: 0,
    }
  })

  for (const row of rows) {
    const timestamp = count(row.created_at)
    if (timestamp < start || timestamp >= end) continue
    const bucket = buckets[Math.min(total - 1, Math.floor((timestamp - start) / size))]
    if (!bucket) continue
    bucket.requests += count(row.count)
    bucket.tokens += count(row.token_used)
    bucket.cost += count(row.quota)
  }

  return buckets
}

interface MonitorCenterProps {
  rows: readonly OverviewQuotaRow[]
  metrics: DashboardMetrics | undefined
  /** Successful consume requests logged since local midnight. */
  requestsToday: number
  loading: boolean
}

/**
 * Monitor Center: one range control driving a health gauge, a live traffic
 * chart and the four headline figures for the window.
 *
 * Every figure comes from an existing read-only admin endpoint:
 * `GET /api/log/live_stat` for exact window totals, `GET /api/log/stat` for the
 * live per-minute rate, and the hourly quota aggregate already loaded by the
 * overview for the chart buckets.
 */
export function MonitorCenter(props: MonitorCenterProps) {
  const { t } = useTranslation()
  const [rangeId, setRangeId] = useState<RangeId>('24h')
  const range = RANGES.find((item) => item.id === rangeId) ?? RANGES[3]
  const [now] = useState(() => new Date())
  const endSeconds = Math.floor(now.getTime() / 1000)

  const liveStatQuery = useQuery({
    queryKey: ['admin-overview', 'monitor-live-stat', range.id],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminLiveStat({
          start_timestamp: endSeconds - range.seconds,
          end_timestamp: endSeconds,
        })
      ),
    refetchInterval: LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: LIVE_REFRESH_MS - 100,
  })

  // Per-minute rates always describe the last minute, whatever window the
  // cards are showing; that is what an operator reads them for.
  const rateQuery = useQuery({
    queryKey: ['admin-overview', 'monitor-rate'],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminLogStat({
          start_timestamp: endSeconds - 60,
          end_timestamp: endSeconds,
        })
      ),
    refetchInterval: LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: LIVE_REFRESH_MS - 100,
  })

  const buckets = useMemo(
    () => buildTrafficBuckets(props.rows, range, now),
    [props.rows, range, now]
  )
  const peak = buckets.reduce(
    (max, bucket) => Math.max(max, bucket.requests),
    0
  )
  const windowTotals = liveStatQuery.data?.data
  const failedToday = props.metrics?.failed_requests_today ?? 0
  const attemptsToday = props.requestsToday + failedToday
  const successRate =
    props.metrics == null || attemptsToday === 0
      ? null
      : (props.requestsToday / attemptsToday) * 100

  const rangeLabel = t(range.id)
  const bucketLabel = range.bucket === 'hour' ? t('hour') : t('day')
  const liveLoading = liveStatQuery.isLoading
  const requestsSparkline = buckets.map((bucket) => bucket.requests)
  const costSparkline = buckets.map((bucket) => bucket.cost)
  const tokensSparkline = buckets.map((bucket) => bucket.tokens)

  // Three states, kept out of the JSX: loading, a sub-hour window with no
  // server-side bucket, and the bucketed chart.
  let chartBody: React.ReactNode
  if (props.loading && buckets.length > 0) {
    chartBody = <Skeleton className='h-36 w-full sm:h-44' />
  } else if (buckets.length === 0) {
    chartBody = (
      <LiveWindow
        requests={windowTotals?.requests}
        tokens={windowTotals?.tokens}
        cost={windowTotals?.quota}
        loading={liveLoading}
        error={liveStatQuery.isError}
        onRetry={() => void liveStatQuery.refetch()}
      />
    )
  } else {
    chartBody = (
      <TrafficChart
        buckets={buckets}
        peak={peak}
        ariaLabel={t('Requests per {{bucket}}', { bucket: bucketLabel })}
      />
    )
  }

  return (
    <div className='flex flex-col gap-2.5 sm:gap-4'>
      <div className='grid gap-2.5 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]'>
        <Card className='gap-0 overflow-hidden border-console-line py-0 shadow-console-card'>
          <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2 border-b border-console-line px-3 py-2.5 sm:px-4'>
            <div className='flex min-w-0 items-center gap-2'>
              <span className='bg-console-track text-console-ink-2 flex size-7 shrink-0 items-center justify-center rounded-md'>
                <Activity className='size-4' aria-hidden='true' />
              </span>
              <div className='min-w-0'>
                <p className='text-console-ink truncate text-sm font-semibold'>
                  {t('Live traffic')}
                </p>
                <p className='text-console-ink-3 truncate text-xs'>
                  {range.bucket === 'live'
                    ? t('Live totals for the last {{range}}', {
                        range: rangeLabel,
                      })
                    : t('Requests per {{bucket}}', {
                        bucket: bucketLabel,
                      })}
                </p>
              </div>
            </div>
            <Tabs
              value={rangeId}
              onValueChange={(value) => {
                const next = RANGES.find((item) => item.id === value)
                if (next) setRangeId(next.id)
              }}
            >
              <TabsList aria-label={t('Time range')}>
                {RANGES.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className='px-1.5 text-xs sm:px-2.5'
                  >
                    {t(item.id)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className='px-3 py-3 sm:px-4 sm:py-4'>
            {chartBody}
            <div className='text-console-ink-3 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
              <span>
                {t('Requests per minute')}:{' '}
                <span className='text-console-ink font-mono font-semibold tabular-nums'>
                  {rateQuery.data?.data?.rpm != null
                    ? formatInteger(rateQuery.data.data.rpm)
                    : '—'}
                </span>
              </span>
              <span>
                {t('Tokens per minute')}:{' '}
                <span className='text-console-ink font-mono font-semibold tabular-nums'>
                  {rateQuery.data?.data?.tpm != null
                    ? formatInteger(rateQuery.data.data.tpm)
                    : '—'}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className='gap-0 overflow-hidden border-console-line py-0 shadow-console-card'>
          <CardHeader className='border-b border-console-line px-3 py-2.5 sm:px-4'>
            <p className='text-console-ink text-sm font-semibold'>
              {t('Platform health')}
            </p>
            <p className='text-console-ink-3 text-xs'>{t('Today')}</p>
          </CardHeader>
          <CardContent className='flex flex-col items-center gap-3 px-3 py-4 sm:px-4'>
            <HealthRing score={successRate} caption={t('Success rate')} />
            <div className='grid w-full grid-cols-2 gap-2'>
              <HealthFact
                icon={<AlertTriangle className='size-3.5' aria-hidden='true' />}
                label={t('Failed today')}
                value={formatInteger(failedToday)}
                tone={failedToday > 0 ? 'warn' : 'default'}
              />
              <HealthFact
                icon={<Users className='size-3.5' aria-hidden='true' />}
                label={t('Active visitors')}
                value={
                  props.metrics
                    ? formatInteger(props.metrics.active_visitors_today)
                    : '—'
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4'>
        <StatTile>
          <StatCard
            title={`${t('Requests')} · ${rangeLabel}`}
            value={
              windowTotals ? formatInteger(windowTotals.requests) : '—'
            }
            icon={Activity}
            tone='accent-1'
            compactMobile
            sparkline={requestsSparkline}
            sparklineVariant='bars'
            loading={liveLoading}
          />
        </StatTile>
        <StatTile>
          <StatCard
            title={`${t('Tokens')} · ${rangeLabel}`}
            value={windowTotals ? formatCompactNumber(windowTotals.tokens) : '—'}
            icon={Cpu}
            tone='accent-3'
            compactMobile
            sparkline={tokensSparkline}
            sparklineVariant='line'
            loading={liveLoading}
          />
        </StatTile>
        <StatTile>
          <StatCard
            title={`${t('Revenue')} · ${rangeLabel}`}
            value={windowTotals ? formatDashboardQuota(windowTotals.quota) : '—'}
            icon={Coins}
            tone='accent-2'
            compactMobile
            sparkline={costSparkline}
            sparklineVariant='line'
            loading={liveLoading}
          />
        </StatTile>
        <StatTile>
          <StatCard
            title={`${t('Active users')} · ${rangeLabel}`}
            value={windowTotals ? formatInteger(windowTotals.users) : '—'}
            icon={Zap}
            tone='accent-1'
            compactMobile
            loading={liveLoading}
          />
        </StatTile>
      </div>
    </div>
  )
}

/** Bars with no chart dependency: one column per bucket, scaled to the peak. */
function TrafficChart(props: {
  buckets: TrafficBucket[]
  peak: number
  ariaLabel: string
}) {
  const total = props.buckets.reduce(
    (sum, bucket) => sum + bucket.requests,
    0
  )
  return (
    <div className='flex flex-col gap-1.5'>
      <div
        className='flex h-36 items-end gap-[3px] sm:h-44'
        role='img'
        aria-label={`${props.ariaLabel}: ${total}`}
      >
        {props.buckets.map((bucket) => {
          const height =
            props.peak > 0 ? (bucket.requests / props.peak) * 100 : 0
          return (
            <div
              key={bucket.label}
              className='group relative flex h-full flex-1 items-end'
              title={`${bucket.label} · ${bucket.requests}`}
            >
              <span
                className='bg-primary/75 group-hover:bg-primary w-full rounded-t-[2px] transition-[height,background-color] duration-300'
                style={{ height: `${Math.max(bucket.requests > 0 ? 3 : 0, height)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className='text-console-ink-3 flex justify-between text-xs tabular-nums'>
        <span>{props.buckets.at(0)?.label}</span>
        <span className='hidden sm:inline'>
          {props.buckets.at(Math.floor(props.buckets.length / 2))?.label}
        </span>
        <span>{props.buckets.at(-1)?.label}</span>
      </div>
    </div>
  )
}

/** Sub-hour windows have no server-side bucket; show the exact totals instead. */
function LiveWindow(props: {
  requests?: number
  tokens?: number
  cost?: number
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  if (props.error) {
    return (
      <div className='flex h-36 items-center justify-center sm:h-44'>
        <Button variant='outline' size='sm' onClick={props.onRetry}>
          {t('Retry')}
        </Button>
      </div>
    )
  }
  return (
    <div className='grid h-36 grid-cols-3 items-center gap-3 sm:h-44'>
      <LiveFigure
        label={t('Requests')}
        value={props.requests == null ? '—' : formatInteger(props.requests)}
        loading={props.loading}
      />
      <LiveFigure
        label={t('Tokens')}
        value={
          props.tokens == null ? '—' : formatCompactNumber(props.tokens)
        }
        loading={props.loading}
      />
      <LiveFigure
        label={t('Revenue')}
        value={props.cost == null ? '—' : formatDashboardQuota(props.cost)}
        loading={props.loading}
      />
    </div>
  )
}

function LiveFigure(props: {
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <span className='text-console-ink-3 truncate text-xs font-medium'>
        {props.label}
      </span>
      {props.loading ? (
        <Skeleton className='h-7 w-20' />
      ) : (
        <span className='text-console-ink truncate font-mono text-xl font-semibold tabular-nums sm:text-2xl'>
          {props.value}
        </span>
      )}
    </div>
  )
}

function HealthFact(props: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'default' | 'warn'
}) {
  return (
    <div className='bg-console-panel rounded-md px-2.5 py-2'>
      <div className='text-console-ink-3 flex items-center gap-1 text-xs font-medium'>
        {props.icon}
        <span className='truncate'>{props.label}</span>
      </div>
      <div
        className={cn(
          'mt-1 truncate font-mono text-sm font-semibold tabular-nums',
          props.tone === 'warn' ? 'text-warning' : 'text-console-ink'
        )}
      >
        {props.value}
      </div>
    </div>
  )
}

function StatTile(props: { children: React.ReactNode }) {
  return (
    <div className='bg-console-surface border-console-line shadow-console-card rounded-xl border p-3 sm:rounded-2xl sm:p-4'>
      {props.children}
    </div>
  )
}
