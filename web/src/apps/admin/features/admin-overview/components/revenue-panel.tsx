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
import { ArrowDownIcon, ArrowUpIcon, CircleDollarSign } from 'lucide-react'
import { memo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, Line, LineChart } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/shared/components/ui/chart'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { TitledCard } from '@/shared/components/ui/titled-card'
import {
  formatDashboardQuota,
  formatPercent,
} from '@/shared/lib/format'

import type { DailyRevenuePoint, MonthlyRevenuePoint } from '../types'
import { AnalyticsTooltip, AnalyticsXAxis, AnalyticsYAxis } from './chart-kit'

type ChartView = 'daily' | 'monthly'

export interface RevenuePanelProps {
  points: DailyRevenuePoint[]
  monthlyPoints: MonthlyRevenuePoint[]
  revenueToday: number
  revenueMonth: number
  revenueAllTime: number | null
  revenueYesterday: number | undefined
  daysElapsed: number
  loading: boolean
}

const MONTHS_SHOWN = 2

export const RevenuePanel = memo(function RevenuePanel(
  props: RevenuePanelProps
) {
  const { t } = useTranslation()
  const [view, setView] = useState<ChartView>('daily')
  const hasData =
    props.points.some((point) => point.quota > 0) ||
    props.monthlyPoints.some((point) => point.quota > 0)

  const dayOverDayDelta =
    props.revenueYesterday != null
      ? props.revenueToday - props.revenueYesterday
      : undefined
  const dayOverDayPercent =
    props.revenueYesterday != null && props.revenueYesterday > 0
      ? ((props.revenueToday - props.revenueYesterday) /
          props.revenueYesterday) *
        100
      : undefined

  const description =
    view === 'monthly'
      ? t('Revenue over the last {{count}} months', { count: MONTHS_SHOWN })
      : t('Revenue over the last 30 days')

  const chartConfig = {
    quota: {
      label: t('Revenue'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  let chartContent: ReactNode
  if (props.loading) {
    chartContent = <Skeleton className='h-full w-full' />
  } else if (!hasData) {
    chartContent = <EmptyChart />
  } else if (view === 'monthly') {
    chartContent = (
      <MonthlyChart points={props.monthlyPoints} chartConfig={chartConfig} />
    )
  } else {
    chartContent = (
      <DailyChart points={props.points} chartConfig={chartConfig} />
    )
  }

  return (
    <TitledCard
      title={t('Sales & Revenue')}
      description={description}
      icon={<CircleDollarSign />}
      iconTone='success'
      headerClassName='p-3 sm:p-5'
      action={
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as ChartView)}
          className='w-fit'
        >
          <TabsList aria-label={t('View')}>
            <TabsTrigger value='daily' className='px-2.5 text-xs sm:px-3 sm:text-sm'>
              {t('Daily')}
            </TabsTrigger>
            <TabsTrigger
              value='monthly'
              className='px-2.5 text-xs sm:px-3 sm:text-sm'
            >
              {t('Monthly')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className='flex flex-col gap-3'>
        <div className='h-44 w-full sm:h-56'>{chartContent}</div>

        <dl className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          <SummaryCell
            label={t('Today')}
            value={formatDashboardQuota(props.revenueToday)}
            sub={
              dayOverDayDelta !== undefined ? (
                <RevenueTrend
                  delta={dayOverDayDelta}
                  percent={dayOverDayPercent}
                />
              ) : (
                <span className='text-muted-foreground text-[10px]'>
                  {t('vs yesterday')}
                </span>
              )
            }
          />
          <SummaryCell
            label={t('This month')}
            value={formatDashboardQuota(props.revenueMonth)}
          />
          <SummaryCell
            label={t('Daily average')}
            value={formatDashboardQuota(props.revenueMonth / props.daysElapsed)}
          />
          <SummaryCell
            label={t('All time')}
            value={
              props.revenueAllTime == null
                ? '-'
                : formatDashboardQuota(props.revenueAllTime)
            }
          />
        </dl>
      </div>
    </TitledCard>
  )
})

function RevenueTrend(props: { delta: number; percent?: number }) {
  const isPositive = props.delta >= 0
  const color = isPositive ? 'text-success' : 'text-destructive'
  const Arrow = isPositive ? ArrowUpIcon : ArrowDownIcon
  const sign = props.delta > 0 ? '+' : ''

  return (
    <div className='flex items-center gap-1'>
      <Arrow className={`size-3 shrink-0 ${color}`} aria-hidden='true' />
      <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
        {sign}
        {formatDashboardQuota(props.delta)}
      </span>
      {props.percent != null && (
        <span className='text-muted-foreground text-[10px] tabular-nums'>
          ({sign}
          {formatPercent(Math.abs(props.percent))})
        </span>
      )}
    </div>
  )
}

function SummaryCell(props: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className='bg-muted/40 min-w-0 rounded-lg px-2.5 py-1.5'>
      <dt className='text-muted-foreground truncate text-[10px] font-medium'>
        {props.label}
      </dt>
      <dd className='mt-0.5 truncate font-mono text-xs font-semibold tabular-nums'>
        {props.value}
      </dd>
      {props.sub != null && <div className='mt-0.5'>{props.sub}</div>}
    </div>
  )
}

function DailyChart({
  points,
  chartConfig,
}: {
  points: DailyRevenuePoint[]
  chartConfig: ChartConfig
}) {
  return (
    <ChartContainer config={chartConfig} className='aspect-auto h-full w-full'>
      <AreaChart
        data={points}
        margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id='revenueDailyGradient' x1='0' y1='0' x2='0' y2='1'>
            <stop
              offset='5%'
              stopColor='var(--color-quota)'
              stopOpacity={0.45}
            />
            <stop
              offset='95%'
              stopColor='var(--color-quota)'
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <AnalyticsXAxis dataKey='label' />
        <AnalyticsYAxis kind='money' />
        <AnalyticsTooltip formatter={formatDashboardQuota} />
        <Area
          type='monotone'
          dataKey='quota'
          stroke='var(--color-quota)'
          fill='url(#revenueDailyGradient)'
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function MonthlyChart({
  points,
  chartConfig,
}: {
  points: MonthlyRevenuePoint[]
  chartConfig: ChartConfig
}) {
  return (
    <ChartContainer config={chartConfig} className='aspect-auto h-full w-full'>
      <LineChart
        data={points}
        margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <AnalyticsXAxis dataKey='label' />
        <AnalyticsYAxis kind='money' />
        <AnalyticsTooltip formatter={formatDashboardQuota} />
        <Line
          type='monotone'
          dataKey='quota'
          stroke='var(--color-quota)'
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-quota)' }}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

function EmptyChart() {
  const { t } = useTranslation()
  return (
    <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
      {t('No data available')}
    </div>
  )
}
