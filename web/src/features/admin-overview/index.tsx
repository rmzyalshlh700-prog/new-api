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
import { Coins, Cpu } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { TitledCard } from '@/components/ui/titled-card'
import {
  formatCompactNumber,
  formatInteger,
  formatLogQuota,
  formatPercent,
} from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { getStartOfDay } from '@/lib/time'

import {
  getAdminLogStat,
  getAdminQuotaRows,
  getAdminRegisteredUserTotal,
  getAdminUserQuotaRows,
} from './api'
import { KpiTile } from './components/kpi-tile'
import { ModelUsagePanel } from './components/model-usage-panel'
import { RangeControl } from './components/range-control'
import { TokenHeatmap } from './components/token-heatmap'
import { TrendPanel } from './components/trend-panel'
import { UsersPanel } from './components/users-panel'
import {
  buildBucketSeries,
  buildDailyActivity,
  buildDailyRevenue,
  buildHourlyActiveUsers,
  buildModelUsage,
  buildMonthlyRevenue,
  buildTodayTokenSeries,
  countActiveUsers,
  sumUsage,
  sumUsageSince,
} from './lib/aggregate'
import {
  deltaPercent,
  deltaTone,
  parseOverviewRange,
  RANGE_STORAGE_KEY,
  rangeLabelKey,
  resolveRangeWindow,
} from './lib/ranges'

const OVERVIEW_REFRESH_MS = 60 * 1000
const HEATMAP_REFRESH_MS = 10 * 60 * 1000
const ALL_TIME_REFRESH_MS = 5 * 60 * 1000
const HEATMAP_DAYS = 8 * 7
const TOP_MODEL_LIMIT = 6
const TREND_DAYS = 30
const MONTHS_SHOWN = 2

const HOURLY_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

function readStoredRange(): string {
  try {
    return localStorage.getItem(RANGE_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function AdminOverview() {
  const { t } = useTranslation()
  const [range, setRange] = useState(() =>
    parseOverviewRange(readStoredRange())
  )
  useEffect(() => {
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, range)
    } catch {
      // Storage unavailable (private mode); the range just resets next visit.
    }
  }, [range])

  const rangeWindow = useMemo(() => resolveRangeWindow(range), [range])
  const monthStart = useMemo(() => {
    const now = new Date()
    return Math.floor(
      new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
    )
  }, [])
  const lastMonthStart = useMemo(() => {
    const now = new Date()
    return Math.floor(
      new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000
    )
  }, [])
  const todayStart = useMemo(
    () => Math.floor(getStartOfDay().getTime() / 1000),
    []
  )
  const currentHour = new Date().getHours()
  // One fetch serves the window, its previous-period comparison and the
  // monthly chart: it starts at whichever is earliest of the three.
  const fetchStart = Math.min(rangeWindow.previousStart, lastMonthStart)

  const quotaQuery = useQuery({
    queryKey: ['admin-overview', 'quota', fetchStart],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminQuotaRows({
          start_timestamp: fetchStart,
          end_timestamp: rangeWindow.end,
        })
      ),
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS - 5000,
  })

  const heatmapStart = useMemo(() => {
    const start = getStartOfDay()
    start.setDate(start.getDate() - (HEATMAP_DAYS - 1))
    return Math.floor(start.getTime() / 1000)
  }, [])
  const heatmapQuery = useQuery({
    queryKey: ['admin-overview', 'heatmap', heatmapStart],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminQuotaRows({
          start_timestamp: heatmapStart,
          end_timestamp: Math.floor(Date.now() / 1000) + 3600,
        })
      ),
    refetchInterval: HEATMAP_REFRESH_MS,
    staleTime: HEATMAP_REFRESH_MS - 5000,
  })

  const activeUsersQuery = useQuery({
    queryKey: ['admin-overview', 'active-users'],
    queryFn: async () => {
      const now = Math.floor(Date.now() / 1000)
      return requireServerSuccess(
        await getAdminUserQuotaRows({
          start_timestamp: now - 24 * 3600,
          end_timestamp: now + 3600,
        })
      )
    },
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS - 5000,
  })

  const allTimeRevenueQuery = useQuery({
    queryKey: ['admin-overview', 'all-time-revenue'],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminLogStat({
          end_timestamp: Math.floor(Date.now() / 1000),
        })
      ),
    refetchInterval: ALL_TIME_REFRESH_MS,
    staleTime: ALL_TIME_REFRESH_MS,
  })

  const registeredUsersQuery = useQuery({
    queryKey: ['admin-overview', 'registered-users'],
    queryFn: async () =>
      requireServerSuccess(await getAdminRegisteredUserTotal()),
    staleTime: ALL_TIME_REFRESH_MS,
  })

  const rows = useMemo(() => quotaQuery.data?.data ?? [], [quotaQuery.data])
  const activeRows = useMemo(
    () => activeUsersQuery.data?.data ?? [],
    [activeUsersQuery.data]
  )
  const heatmapRows = useMemo(
    () => heatmapQuery.data?.data ?? [],
    [heatmapQuery.data]
  )

  const bucketSeries = useMemo(
    () => buildBucketSeries(rows, rangeWindow),
    [rows, rangeWindow]
  )
  const totalsWindow = useMemo(
    () =>
      bucketSeries.reduce(
        (sum, point) => ({
          quota: sum.quota + point.quota,
          tokens: sum.tokens + point.tokens,
          requests: sum.requests + point.requests,
        }),
        { quota: 0, tokens: 0, requests: 0 }
      ),
    [bucketSeries]
  )
  const totalsPrevious = useMemo(
    () =>
      sumUsage(
        rows.filter(
          (row) =>
            (row.created_at ?? 0) >= rangeWindow.previousStart &&
            (row.created_at ?? 0) < rangeWindow.previousEnd
        )
      ),
    [rows, rangeWindow]
  )
  const totalsToday = useMemo(
    () => sumUsageSince(rows, todayStart),
    [rows, todayStart]
  )
  const totalsMonth = useMemo(
    () => sumUsageSince(rows, monthStart),
    [rows, monthStart]
  )
  const revenueTrend = useMemo(
    () => buildDailyRevenue(rows, TREND_DAYS),
    [rows]
  )
  const monthlyRevenueTrend = useMemo(
    () => buildMonthlyRevenue(rows, MONTHS_SHOWN),
    [rows]
  )
  const topModels = useMemo(
    () =>
      buildModelUsage(
        rows.filter((row) => (row.created_at ?? 0) >= rangeWindow.start)
      ).slice(0, TOP_MODEL_LIMIT),
    [rows, rangeWindow.start]
  )
  const tokenSeries = useMemo(
    () => buildTodayTokenSeries(rows, todayStart, currentHour),
    [rows, todayStart, currentHour]
  )
  const heatmapData = useMemo(
    () => buildDailyActivity(heatmapRows, HEATMAP_DAYS),
    [heatmapRows]
  )
  const activeUserCount = useMemo(
    () => countActiveUsers(activeRows),
    [activeRows]
  )
  const hourlyActivity = useMemo(
    () => buildHourlyActiveUsers(activeRows),
    [activeRows]
  )

  const registeredUsers = Number(registeredUsersQuery.data?.data?.total ?? 0)
  const stat = allTimeRevenueQuery.data?.data
  const allTimeRevenue = stat == null ? null : Number(stat.quota ?? 0)

  const sparklineFromBuckets = (key: 'quota' | 'tokens' | 'requests') =>
    bucketSeries.map((point) => ({
      label: point.label,
      value: point[key],
    }))

  const consumptionDelta = deltaPercent(
    totalsWindow.quota,
    totalsPrevious.quota
  )
  const tokensDelta = deltaPercent(totalsWindow.tokens, totalsPrevious.tokens)
  const requestsDelta = deltaPercent(
    totalsWindow.requests,
    totalsPrevious.requests
  )
  const activeRate =
    registeredUsers > 0 ? (activeUserCount / registeredUsers) * 100 : 0

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Dashboard')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
          <span
            className='bg-success size-1.5 rounded-full'
            aria-hidden='true'
          />
          {t('Live data, refreshed every minute')}
        </span>
        <RangeControl value={range} onChange={setRange} />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-3 sm:gap-4'>
          <FadeIn>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4'>
              <KpiTile
                label={t('Consumption')}
                value={totalsWindow.quota}
                title={formatLogQuota(totalsWindow.quota)}
                pipTone={deltaTone(consumptionDelta)}
                caption={
                  consumptionDelta == null
                    ? t(rangeLabelKey(range))
                    : `${consumptionDelta >= 0 ? '+' : ''}${formatPercent(consumptionDelta)} ${t('vs previous period')}`
                }
                splits={[
                  {
                    id: 'month',
                    text: (
                      <>
                        {t('This month')}:{' '}
                        <b className='font-semibold tabular-nums'>
                          {formatLogQuota(totalsMonth.quota)}
                        </b>
                      </>
                    ),
                  },
                ]}
                sparkline={sparklineFromBuckets('quota')}
                sparklineColor='var(--chart-1)'
                loading={quotaQuery.isLoading}
              />
              <KpiTile
                label={t('Tokens')}
                value={totalsWindow.tokens}
                format={{ notation: 'compact', maximumFractionDigits: 1 }}
                title={`${formatInteger(totalsWindow.tokens)} ${t('Tokens')}`}
                pipTone={deltaTone(tokensDelta)}
                caption={
                  tokensDelta == null
                    ? t(rangeLabelKey(range))
                    : `${tokensDelta >= 0 ? '+' : ''}${formatPercent(tokensDelta)} ${t('vs previous period')}`
                }
                splits={[
                  {
                    id: 'requests',
                    text: (
                      <>
                        {t('Requests')}:{' '}
                        <b className='font-semibold tabular-nums'>
                          {formatInteger(totalsWindow.requests)}
                        </b>
                      </>
                    ),
                  },
                ]}
                sparkline={sparklineFromBuckets('tokens')}
                sparklineColor='var(--chart-2)'
                loading={quotaQuery.isLoading}
              />
              <KpiTile
                label={t('Requests')}
                value={totalsWindow.requests}
                pipTone={deltaTone(requestsDelta)}
                caption={
                  <>
                    {t('Requests per minute')}:{' '}
                    <b className='font-semibold tabular-nums'>
                      {stat?.rpm == null ? '—' : formatInteger(stat.rpm)}
                    </b>
                  </>
                }
                splits={[
                  {
                    id: 'tpm',
                    text: (
                      <>
                        {t('Tokens per minute')}:{' '}
                        <b className='font-semibold tabular-nums'>
                          {stat?.tpm == null
                            ? '—'
                            : formatCompactNumber(stat.tpm)}
                        </b>
                      </>
                    ),
                  },
                  {
                    id: 'requests-delta',
                    text:
                      requestsDelta == null
                        ? t(rangeLabelKey(range))
                        : `${requestsDelta >= 0 ? '+' : ''}${formatPercent(requestsDelta)} ${t('vs previous period')}`,
                    tone: 'muted',
                  },
                ]}
                sparkline={sparklineFromBuckets('requests')}
                sparklineColor='var(--chart-4)'
                loading={quotaQuery.isLoading}
              />
              <KpiTile
                label={t('Active users (24h)')}
                value={activeUserCount}
                pipTone={activeRate >= 10 ? 'success' : null}
                caption={
                  <>
                    {t('Active rate')}:{' '}
                    <b className='font-semibold tabular-nums'>
                      {formatPercent(activeRate)}
                    </b>
                  </>
                }
                splits={[
                  {
                    id: 'registered',
                    text: (
                      <>
                        {t('Registered users')}:{' '}
                        <b className='font-semibold tabular-nums'>
                          {formatInteger(registeredUsers)}
                        </b>
                      </>
                    ),
                  },
                ]}
                sparkline={hourlyActivity.map((point) => ({
                  label: point.label,
                  value: point.activeUsers,
                }))}
                sparklineColor='var(--chart-5)'
                loading={activeUsersQuery.isLoading}
              />
            </div>
          </FadeIn>

          <div className='grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'>
            <FadeIn delay={0.05}>
              <TrendPanel
                points={revenueTrend.map((point) => ({
                  label: point.label,
                  quota: point.quota,
                  tokens: 0,
                  requests: 0,
                }))}
                monthlyPoints={monthlyRevenueTrend}
                today={totalsWindow.quota}
                month={totalsMonth.quota}
                allTime={allTimeRevenue}
                average={totalsMonth.quota / Math.max(1, new Date().getDate())}
                loading={quotaQuery.isLoading}
              />
            </FadeIn>
            <FadeIn delay={0.1}>
              <ModelUsagePanel
                models={topModels}
                loading={quotaQuery.isLoading}
              />
            </FadeIn>
          </div>

          <div className='grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'>
            <FadeIn delay={0.15}>
              <TitledCard
                title={t('Token activity')}
                icon={<Cpu />}
                iconTone='chart-2'
                disableHoverEffect
                description={t(
                  'Daily token volume over the last {{count}} days',
                  {
                    count: HEATMAP_DAYS,
                  }
                )}
              >
                <TokenHeatmap
                  points={heatmapData}
                  loading={heatmapQuery.isLoading}
                />
              </TitledCard>
            </FadeIn>
            <FadeIn delay={0.2}>
              <UsersPanel
                points={hourlyActivity}
                activeUsers={activeUserCount}
                registeredUsers={registeredUsers}
                loading={activeUsersQuery.isLoading}
              />
            </FadeIn>
          </div>

          <FadeIn delay={0.25}>
            <TitledCard
              title={t('Hourly token usage')}
              icon={<Coins />}
              iconTone='warning'
              disableHoverEffect
              description={t('Token usage per hour today, split by model')}
            >
              <HourlyTokenChart
                series={tokenSeries}
                loading={quotaQuery.isLoading}
              />
            </TitledCard>
          </FadeIn>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

/** Today's hourly token usage by model, stacked into one compact area plot. */
function HourlyTokenChart(props: {
  series: ReturnType<typeof buildTodayTokenSeries>
  loading?: boolean
}) {
  const { t } = useTranslation()
  const topSeries = props.series.series.slice(0, 5)
  const hasData = props.series.points.some((point) => point.total > 0)

  if (props.loading) {
    return <div className='bg-muted h-48 w-full animate-pulse rounded-md' />
  }
  if (!hasData) {
    return (
      <div className='text-muted-foreground flex h-48 items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  }

  const config: ChartConfig = {}
  for (const [index, entry] of topSeries.entries()) {
    config[entry.key] = {
      label: entry.model,
      color: HOURLY_COLORS[index % HOURLY_COLORS.length],
    }
  }

  return (
    <ChartContainer config={config} className='aspect-auto h-48 w-full'>
      <AreaChart
        data={props.series.points}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis
          dataKey='label'
          tickLine={false}
          axisLine={false}
          minTickGap={24}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--border)' }}
          content={<ChartTooltipContent />}
        />
        {topSeries.map((entry) => (
          <Area
            key={entry.key}
            type='monotone'
            dataKey={entry.key}
            stackId='tokens'
            stroke={`var(--color-${entry.key})`}
            fill={`var(--color-${entry.key})`}
            fillOpacity={0.2}
            strokeWidth={1.5}
            animationDuration={450}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}
