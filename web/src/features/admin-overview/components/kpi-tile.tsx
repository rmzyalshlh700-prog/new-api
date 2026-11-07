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
import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { RollingNumber, type RollingNumberFormat } from './rolling-number'
import { TileSparkline, type SparklinePoint } from './tile-sparkline'

export interface KpiTileProps {
  label: string
  value: number | null | undefined
  format?: RollingNumberFormat
  prefix?: string
  suffix?: string
  /** Exact value for the hover title when the visible readout is compact. */
  title?: string
  /** Left caption: a verdict pip plus short evidence text. */
  caption?: ReactNode
  /** Verdict tone of the pip; null hides the pip. */
  pipTone?: 'success' | 'warning' | 'danger' | null
  /** Right-side caption entries rendered after the hairline separator. */
  splits?: Array<{
    id: string
    text: ReactNode
    tone?: 'default' | 'danger' | 'muted'
  }>
  sparkline?: SparklinePoint[]
  sparklineColor?: string
  loading?: boolean
  className?: string
}

const PIP_TONE_CLASS: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}

const SPLIT_TONE_CLASS: Record<string, string> = {
  default: 'text-foreground/90',
  danger: 'text-destructive',
  muted: 'text-muted-foreground/70',
}

/**
 * The dashboard's KPI tile: a muted label, one large rolling figure, an
 * evidence caption under a hairline and a compact trend sparkline, mirroring
 * the reference console's tile anatomy.
 */
export function KpiTile(props: KpiTileProps) {
  return (
    <section
      className={cn(
        'bg-card rounded-xl border p-4 shadow-xs transition-shadow duration-200 hover:shadow-md',
        props.className
      )}
    >
      <div className='flex items-center gap-1.5'>
        <span className='text-muted-foreground text-[13px] font-medium tracking-wide'>
          {props.label}
        </span>
      </div>
      {props.loading ? (
        <Skeleton className='mt-2.5 h-9 w-3/5' />
      ) : (
        <div
          className='mt-2.5 truncate text-[30px] leading-tight font-bold tracking-tight tabular-nums sm:text-[32px]'
          title={props.title}
        >
          <RollingNumber
            value={props.value}
            format={props.format}
            prefix={props.prefix}
            suffix={props.suffix}
          />
        </div>
      )}
      {!props.loading && (props.caption != null || props.splits?.length) && (
        <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
          {props.caption != null && (
            <span className='inline-flex items-center gap-1.5'>
              {props.pipTone != null && (
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    PIP_TONE_CLASS[props.pipTone]
                  )}
                  aria-hidden='true'
                />
              )}
              {props.caption}
            </span>
          )}
          {props.splits?.map((split) => (
            <span
              key={split.id}
              className={cn(
                'inline-flex items-center gap-1.5 border-l pl-3',
                SPLIT_TONE_CLASS[split.tone ?? 'default']
              )}
            >
              {split.text}
            </span>
          ))}
        </div>
      )}
      {props.sparkline && props.sparkline.length > 1 && !props.loading && (
        <TileSparkline
          points={props.sparkline}
          color={props.sparklineColor ?? 'var(--chart-1)'}
          ariaLabel={props.label}
          className='mt-3'
        />
      )}
      {props.loading && <Skeleton className='mt-3 h-12 w-full' />}
    </section>
  )
}
