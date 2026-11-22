import { Activity } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/shared/components/ui/chart'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { TitledCard } from '@/shared/components/ui/titled-card'
import { formatInteger } from '@/shared/lib/format'

import { buildUsageTrend } from '../lib/aggregate'
import type { OverviewQuotaRow } from '../types'
import { AnalyticsTooltip, AnalyticsXAxis, AnalyticsYAxis } from './chart-kit'

type Metric = 'requests' | 'tokens'
type Range = '1' | '7' | '30'

/**
 * Requests and tokens share one chart with a metric switch instead of two
 * stacked charts: on a phone the pair used to double the card height while
 * showing the same time axis twice.
 */
export const ActivityTrendPanel = memo(function ActivityTrendPanel({
  rows,
  now,
  loading,
  rates,
  ratesLoading,
}: {
  rows: readonly OverviewQuotaRow[]
  now: Date
  loading: boolean
  rates: { rpm: number; tpm: number } | null
  ratesLoading: boolean
}) {
  const { t } = useTranslation()
  const [range, setRange] = useState<Range>('7')
  const [metric, setMetric] = useState<Metric>('requests')
  const points = useMemo(
    () => buildUsageTrend(rows, Number(range) as 1 | 7 | 30, now),
    [rows, range, now]
  )
  const totals = useMemo(
    () => ({
      requests: points.reduce((sum, point) => sum + point.requests, 0),
      tokens: points.reduce((sum, point) => sum + point.tokens, 0),
    }),
    [points]
  )
  const metricLabel = metric === 'requests' ? t('Requests') : t('Tokens')

  let requestsRate = '—'
  let tokensRate = '—'
  if (ratesLoading) {
    requestsRate = '…'
    tokensRate = '…'
  } else if (rates != null) {
    requestsRate = formatInteger(rates.rpm)
    tokensRate = formatInteger(rates.tpm)
  }

  const config: ChartConfig = {
    [metric]: {
      label: metricLabel,
      color: metric === 'requests' ? 'var(--chart-1)' : 'var(--chart-3)',
    },
  }

  return (
    <TitledCard
      title={t('Usage')}
      description={t('Usage data may lag by a few minutes')}
      icon={<Activity className='size-5' />}
      iconTone='chart-1'
      headerClassName='p-3 sm:p-5'
      action={
        <Tabs
          value={range}
          onValueChange={(value) => {
            if (value === '1' || value === '7' || value === '30') {
              setRange(value)
            }
          }}
        >
          <TabsList aria-label={t('Time range')}>
            <TabsTrigger value='1' className='px-2.5 text-xs sm:px-3 sm:text-sm'>
              {t('Today')}
            </TabsTrigger>
            <TabsTrigger value='7' className='px-2.5 text-xs sm:px-3 sm:text-sm'>
              {t('7 Days')}
            </TabsTrigger>
            <TabsTrigger value='30' className='px-2.5 text-xs sm:px-3 sm:text-sm'>
              {t('30 days')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className='flex flex-col gap-3'>
        <div className='grid grid-cols-4 items-end gap-2'>
          <Kpi label={t('Requests')} value={formatInteger(totals.requests)} />
          <Kpi label={t('Tokens')} value={formatInteger(totals.tokens)} />
          <div className='col-span-2 flex min-w-0 flex-col gap-0.5 self-center text-end'>
            <span className='text-muted-foreground truncate text-[10px] font-medium'>
              {t('Requests per minute')}: {requestsRate}
            </span>
            <span className='text-muted-foreground truncate text-[10px] font-medium'>
              {t('Tokens per minute')}: {tokensRate}
            </span>
          </div>
        </div>

        <div className='flex items-center justify-between gap-2'>
          <Tabs
            value={metric}
            onValueChange={(value) => {
              if (value === 'requests' || value === 'tokens') setMetric(value)
            }}
          >
            <TabsList aria-label={t('Usage')}>
              <TabsTrigger
                value='requests'
                className='px-2.5 text-xs sm:px-3 sm:text-sm'
              >
                {t('Requests')}
              </TabsTrigger>
              <TabsTrigger
                value='tokens'
                className='px-2.5 text-xs sm:px-3 sm:text-sm'
              >
                {t('Tokens')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className='h-40 w-full sm:h-48'>
          {loading && <Skeleton className='h-full w-full' />}
          {!loading && totals[metric] === 0 && (
            <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
              {t('No data available')}
            </div>
          )}
          {!loading && totals[metric] > 0 && (
            <ChartContainer
              config={config}
              className='aspect-auto h-full w-full'
            >
              <AreaChart
                data={points}
                margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id='activityTrendGradient'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop
                      offset='0%'
                      stopColor={`var(--color-${metric})`}
                      stopOpacity={0.28}
                    />
                    <stop
                      offset='100%'
                      stopColor={`var(--color-${metric})`}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray='3 3' />
                <AnalyticsXAxis dataKey='label' />
                <AnalyticsYAxis kind='count' />
                <AnalyticsTooltip formatter={formatInteger} />
                <Area
                  type='monotone'
                  dataKey={metric}
                  stroke={`var(--color-${metric})`}
                  fill='url(#activityTrendGradient)'
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </div>
    </TitledCard>
  )
})

function Kpi(props: { label: string; value: string }) {
  return (
    <div className='min-w-0'>
      <div className='text-muted-foreground truncate text-[10px] font-medium'>
        {props.label}
      </div>
      <div className='mt-0.5 truncate font-mono text-base font-semibold tabular-nums sm:text-lg'>
        {props.value}
      </div>
    </div>
  )
}
