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
import { Cpu } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/shared/components/ui/chart'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { TitledCard } from '@/shared/components/ui/titled-card'
import { formatTokens } from '@/shared/lib/format'

import type { TokenSeriesEntry, TokenSeriesPoint } from '../types'
import { AnalyticsTooltip, AnalyticsXAxis, AnalyticsYAxis } from './chart-kit'

const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
] as const

export interface TokenUsagePanelProps {
  series: TokenSeriesEntry[]
  points: TokenSeriesPoint[]
  tokensToday: number
  requestsToday: number
  loading: boolean
}

export const TokenUsagePanel = memo(function TokenUsagePanel(
  props: TokenUsagePanelProps
) {
  const { t } = useTranslation()
  const chartData = props.points.map((point) => ({
    label: point.label,
    ...point.values,
  }))
  const chartConfig: ChartConfig = Object.fromEntries(
    props.series.map((entry, index) => [
      entry.key,
      {
        label: entry.model === 'Other' ? t('Other') : entry.model,
        color: SERIES_COLORS[index] ?? SERIES_COLORS.at(-1),
      },
    ])
  )
  const hasData = props.points.some((point) => point.total > 0)

  let chartContent: ReactNode
  if (props.loading) {
    chartContent = <Skeleton className='h-full w-full' />
  } else if (hasData) {
    chartContent = (
      <ChartContainer
        config={chartConfig}
        className='aspect-auto h-full w-full'
      >
        <BarChart
          data={chartData}
          margin={{ top: 6, right: 4, bottom: 0, left: 0 }}
          barCategoryGap='18%'
        >
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <AnalyticsXAxis dataKey='label' minTickGap={28} />
          <AnalyticsYAxis kind='count' />
          <AnalyticsTooltip formatter={formatTokens} />
          <ChartLegend
            content={
              <ChartLegendContent className='flex-wrap justify-start gap-x-3 gap-y-1 pt-2 text-[11px]' />
            }
          />
          <defs>
            {props.series.map((entry, index) => {
              const color = SERIES_COLORS[index] ?? SERIES_COLORS.at(-1)
              return (
                <linearGradient
                  key={entry.key}
                  id={`tokenSeriesGradient-${entry.key}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop offset='0%' stopColor={color} stopOpacity={0.9} />
                  <stop offset='100%' stopColor={color} stopOpacity={0.5} />
                </linearGradient>
              )
            })}
          </defs>
          {props.series.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              stackId='tokens'
              fill={`url(#tokenSeriesGradient-${entry.key})`}
              maxBarSize={26}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
    )
  } else {
    chartContent = (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  }

  return (
    <TitledCard
      title={t('Token usage today')}
      description={t('Token usage by model today')}
      icon={<Cpu />}
      iconTone='chart-4'
      headerClassName='p-3 sm:p-5'
    >
      <div className='h-56 w-full sm:h-64'>{chartContent}</div>
    </TitledCard>
  )
})
