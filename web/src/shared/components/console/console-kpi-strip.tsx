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

import { cn } from '@/shared/lib/utils'

export type ConsoleKpiTone = 'default' | 'positive' | 'warning' | 'danger'

export type ConsoleKpiItem = {
  /** Stable key; defaults to the label when it is plain text. */
  id?: string
  label: ReactNode
  value: ReactNode
  /** Secondary line: delta, window or unit. */
  hint?: ReactNode
  icon?: ReactNode
  tone?: ConsoleKpiTone
}

const toneClassName: Record<ConsoleKpiTone, string> = {
  default: 'text-console-ink',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-destructive',
}

/**
 * Compact horizontal KPI ribbon. Cells share one hairline-separated surface so
 * a row of metrics reads as a single instrument strip instead of a grid of
 * floating cards.
 */
export function ConsoleKpiStrip(props: {
  items: ConsoleKpiItem[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-console-surface border-console-line divide-console-line grid grid-cols-2 divide-y overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-4 lg:divide-y-0 lg:divide-x rtl:lg:divide-x-reverse',
        props.className
      )}
    >
      {props.items.map((item) => (
        <div
          key={item.id ?? String(item.label)}
          className='flex min-w-0 flex-col gap-1 px-3 py-2.5 sm:px-4'
        >
          <div className='text-console-ink-3 flex min-w-0 items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase'>
            {item.icon}
            <span className='truncate'>{item.label}</span>
          </div>
          <div
            className={cn(
              'truncate text-lg leading-7 font-semibold tabular-nums',
              toneClassName[item.tone ?? 'default']
            )}
          >
            {item.value}
          </div>
          {item.hint ? (
            <div className='text-console-ink-3 truncate text-xs'>
              {item.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
