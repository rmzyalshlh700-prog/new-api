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
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  type PieSectorDataItem,
} from 'recharts'

import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  formatCompactNumber,
  formatInteger,
  formatLogQuota,
  formatPercent,
} from '@/lib/format'

import type { ModelUsage } from '../types'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

const TOP_MODEL_LIMIT = 5

export interface ModelUsagePanelProps {
  models: ModelUsage[]
  loading?: boolean
}

/**
 * Model usage panel: a token-share donut whose legend is the ranked list
 * beside it, with each row carrying the swatch, model, tokens, consumption
 * and share of the window — the ranking and the ring read as one unit.
 */
export function ModelUsagePanel(props: ModelUsagePanelProps) {
  const { t } = useTranslation()
  const [focused, setFocused] = useState<string | null>(null)

  const groups = useMemo(
    () =>
      props.models
        .filter((model) => model.tokens > 0)
        .slice(0, TOP_MODEL_LIMIT)
        .map((model, index) => ({
          ...model,
          color: CHART_COLORS[index % CHART_COLORS.length],
        })),
    [props.models]
  )
  const totalTokens = groups.reduce((sum, group) => sum + group.tokens, 0)
  const hasData = groups.length > 0

  let body: ReactNode
  if (props.loading) {
    body = (
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
        <Skeleton className='mx-auto size-40 shrink-0 rounded-full sm:mx-0' />
        <div className='w-full flex-1 space-y-3'>
          {['row-1', 'row-2', 'row-3', 'row-4'].map((key) => (
            <Skeleton key={key} className='h-6 w-full' />
          ))}
        </div>
      </div>
    )
  } else if (hasData) {
    body = (
      <div className='flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6'>
        <div
          className='relative mx-auto size-40 shrink-0 sm:mx-0'
          aria-hidden='true'
        >
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={groups}
                dataKey='tokens'
                nameKey='model'
                innerRadius='62%'
                outerRadius='92%'
                paddingAngle={2}
                strokeWidth={0}
                activeShape={DonutFocusShape}
                onMouseEnter={(_, index) => setFocused(groups[index].model)}
                onMouseLeave={() => setFocused(null)}
              >
                {groups.map((group) => (
                  <Cell key={group.model} fill={group.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
            <span className='text-muted-foreground text-[10px] tracking-wide uppercase'>
              {t('Tokens')}
            </span>
            <span className='text-lg font-bold tabular-nums'>
              {formatCompactNumber(totalTokens)}
            </span>
          </div>
        </div>
        <ol
          className='grid min-w-0 flex-1 grid-cols-[10px_minmax(0,1fr)_auto] gap-x-2.5'
          aria-label={t('Model usage')}
        >
          <li
            aria-hidden='true'
            className='col-span-3 grid grid-cols-subgrid gap-x-2.5 pb-1'
          >
            <span />
            <span className='text-muted-foreground text-[10px] font-medium tracking-wide uppercase'>
              {t('Tokens')}
            </span>
            <span className='text-muted-foreground text-right text-[10px] font-medium tracking-wide uppercase'>
              {t('Share')}
            </span>
          </li>
          {groups.map((group) => (
            <ModelUsageRow
              key={group.model}
              group={group}
              totalTokens={totalTokens}
              focused={focused === group.model}
              onHover={() => setFocused(group.model)}
              onLeave={() => setFocused(null)}
            />
          ))}
        </ol>
      </div>
    )
  } else {
    body = (
      <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  }

  return (
    <TitledCard
      title={t('Model usage')}
      description={t('Token share by model for the selected window')}
      disableHoverEffect
      contentClassName='flex flex-col'
    >
      {body}
    </TitledCard>
  )
}

interface ModelUsageRowProps {
  group: ModelUsage & { color: string }
  totalTokens: number
  focused: boolean
  onHover: () => void
  onLeave: () => void
}

function ModelUsageRow(props: ModelUsageRowProps) {
  const { t } = useTranslation()
  const share =
    props.totalTokens > 0 ? (props.group.tokens / props.totalTokens) * 100 : 0

  return (
    <li
      className='border-b-border/60 col-span-3 grid grid-cols-subgrid items-center gap-x-2.5 border-b py-2 last:border-b-0'
      onMouseEnter={props.onHover}
      onMouseLeave={props.onLeave}
      aria-label={props.group.model}
    >
      <span
        className='size-2.5 rounded-full'
        style={{ background: props.group.color }}
        aria-hidden='true'
      />
      <span
        dir='auto'
        className={`truncate text-xs ${props.focused ? 'text-foreground font-semibold' : 'text-foreground/90'}`}
        title={`${props.group.model} · ${t('Consumption')}: ${formatLogQuota(props.group.quota)}`}
      >
        {props.group.model}
      </span>
      <span className='text-right text-xs tabular-nums'>
        <span className='text-foreground/90'>
          {formatCompactNumber(props.group.tokens)}
        </span>{' '}
        <span className='text-muted-foreground'>{formatPercent(share)}</span>
      </span>
      <span className='text-muted-foreground col-span-3 text-[10px] tabular-nums'>
        {t('Requests')}: {formatInteger(props.group.requests)}
      </span>
    </li>
  )
}

/** Recharts' widened active slice, tuned for a thin donut ring. */
function DonutFocusShape(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={(outerRadius ?? 0) + 4}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={3}
    />
  )
}
