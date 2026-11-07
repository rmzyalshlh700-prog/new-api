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
import { Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatInteger, formatPercent } from '@/lib/format'

import type { HourlyActivityPoint } from '../types'

const chartConfig = {
  activeUsers: {
    label: 'Active users',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig

export interface UsersPanelProps {
  points: HourlyActivityPoint[]
  activeUsers: number
  registeredUsers: number
  loading?: boolean
}

/**
 * Live audience panel: distinct users over the trailing 24 hours as an hourly
 * column strip, with the totals and active rate read above the plot.
 */
export function UsersPanel(props: UsersPanelProps) {
  const { t } = useTranslation()
  const activeRate =
    props.registeredUsers > 0
      ? (props.activeUsers / props.registeredUsers) * 100
      : 0
  const hasData = props.points.some((point) => point.activeUsers > 0)
  const config = {
    ...chartConfig,
    activeUsers: { ...chartConfig.activeUsers, label: t('Active users (24h)') },
  }

  let chart: ReactNode
  if (props.loading) {
    chart = <Skeleton className='h-full w-full' />
  } else if (hasData) {
    chart = (
      <ChartContainer config={config} className='aspect-auto h-full w-full'>
        <BarChart
          data={props.points}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray='3 3' />
          <XAxis
            dataKey='label'
            tickLine={false}
            axisLine={false}
            minTickGap={20}
            tickMargin={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey='activeUsers'
            fill='var(--color-activeUsers)'
            radius={[3, 3, 0, 0]}
            maxBarSize={18}
            animationDuration={450}
          />
        </BarChart>
      </ChartContainer>
    )
  } else {
    chart = (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  }

  return (
    <TitledCard
      title={t('Active users (24h)')}
      icon={<Users />}
      iconTone='chart-3'
      disableHoverEffect
    >
      <div className='flex flex-col gap-4'>
        <dl className='grid grid-cols-3 gap-2'>
          <SummaryCell
            label={t('Active users (24h)')}
            value={props.loading ? '—' : formatInteger(props.activeUsers)}
          />
          <SummaryCell
            label={t('Registered users')}
            value={props.loading ? '—' : formatInteger(props.registeredUsers)}
          />
          <SummaryCell
            label={t('Active rate')}
            value={props.loading ? '—' : formatPercent(activeRate)}
          />
        </dl>
        <div className='h-40 w-full'>{chart}</div>
      </div>
    </TitledCard>
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
