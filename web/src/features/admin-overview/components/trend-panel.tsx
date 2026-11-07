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
import { CircleDollarSign } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TitledCard } from '@/components/ui/titled-card'
import { formatCompactNumber, formatLogQuota } from '@/lib/format'

import type { BucketSeriesPoint, MonthlyRevenuePoint } from '../types'

type TrendView = 'daily' | 'monthly'

export interface TrendPanelProps {
  points: BucketSeriesPoint[]
  monthlyPoints: MonthlyRevenuePoint[]
  loading?: boolean
  today: number
  month: number
  allTime: number | null
  average: number
}

const chartConfig = {
  quota: {
    label: 'Consumption',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

/**
 * The window's consumption trend: one area chart per day (or month) with the
 * period's summary readouts in a strip under the plot.
 */
export function TrendPanel(props: TrendPanelProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<TrendView>('daily')
  const config = {
    ...chartConfig,
    quota: { ...chartConfig.quota, label: t('Consumption') },
  }
  const hasData =
    props.points.some((point) => point.quota > 0) ||
    props.monthlyPoints.some((point) => point.quota > 0)

  let chart: ReactNode
  if (props.loading) {
    chart = <Skeleton className='h-full w-full' />
  } else if (!hasData) {
    chart = (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  } else if (view === 'monthly') {
    chart = <MonthlyChart points={props.monthlyPoints} config={config} />
  } else {
    chart = <DailyChart points={props.points} config={config} />
  }

  return (
    <TitledCard
      title={t('Consumption trend')}
      icon={<CircleDollarSign />}
      iconTone='success'
      disableHoverEffect
      action={
        <Tabs value={view} onValueChange={(v) => setView(v as TrendView)}>
          <TabsList>
            <TabsTrigger value='daily'>{t('Daily')}</TabsTrigger>
            <TabsTrigger value='monthly'>{t('Monthly')}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='h-56 w-full'>{chart}</div>
        <dl className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          <SummaryCell
            label={t('This window')}
            value={formatLogQuota(props.today)}
          />
          <SummaryCell
            label={t('This month')}
            value={formatLogQuota(props.month)}
          />
          <SummaryCell
            label={t('Daily average')}
            value={formatLogQuota(props.average)}
          />
          <SummaryCell
            label={t('All time')}
            value={props.allTime == null ? '—' : formatLogQuota(props.allTime)}
          />
        </dl>
        <p className='text-muted-foreground text-[11px]'>
          {t('Usage data may lag by a few minutes')}
        </p>
      </div>
    </TitledCard>
  )
}

function DailyChart(props: {
  points: BucketSeriesPoint[]
  config: ChartConfig
}) {
  return (
    <ChartContainer config={props.config} className='aspect-auto h-full w-full'>
      <AreaChart
        data={props.points}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient
            id='overviewTrendGradient'
            x1='0'
            y1='0'
            x2='0'
            y2='1'
          >
            <stop
              offset='0%'
              stopColor='var(--color-quota)'
              stopOpacity={0.5}
            />
            <stop
              offset='100%'
              stopColor='var(--color-quota)'
              stopOpacity={0.03}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis
          dataKey='label'
          tickLine={false}
          axisLine={false}
          minTickGap={28}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--border)' }}
          content={
            <ChartTooltipContent
              formatter={(value) => formatLogQuota(Number(value))}
            />
          }
        />
        <Area
          type='monotone'
          dataKey='quota'
          stroke='var(--color-quota)'
          fill='url(#overviewTrendGradient)'
          strokeWidth={2}
          animationDuration={450}
          animationEasing='ease-out'
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function MonthlyChart(props: {
  points: MonthlyRevenuePoint[]
  config: ChartConfig
}) {
  return (
    <ChartContainer config={props.config} className='aspect-auto h-full w-full'>
      <BarChart
        data={props.points}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray='3 3' />
        <XAxis
          dataKey='label'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value) => formatCompactNumber(Number(value))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => formatLogQuota(Number(value))}
            />
          }
        />
        <Bar
          dataKey='quota'
          fill='var(--color-quota)'
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          animationDuration={450}
        />
      </BarChart>
    </ChartContainer>
  )
}

function SummaryCell(props: { label: string; value: string }) {
  return (
    <div className='bg-muted/40 rounded-lg px-2.5 py-2'>
      <dt className='text-muted-foreground truncate text-[11px] font-medium'>
        {props.label}
      </dt>
      <dd className='mt-1 truncate font-mono text-xs font-semibold tabular-nums'>
        {props.value}
      </dd>
    </div>
  )
}
