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

export type ConsoleSectionCardProps = {
  title?: ReactNode
  hint?: ReactNode
  actions?: ReactNode
  /** Pinned form actions, always visible above any floating launcher. */
  footer?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Settings/form surface: one header row, one content region, one pinned action
 * row. Labels and controls keep a single alignment inside every section.
 */
export function ConsoleSectionCard(props: ConsoleSectionCardProps) {
  return (
    <section
      className={cn(
        'bg-console-surface border-console-line shadow-console-card flex flex-col overflow-hidden rounded-lg border',
        props.className
      )}
    >
      {props.title || props.actions ? (
        <div className='border-console-line flex flex-wrap items-start justify-between gap-2 border-b px-4 py-2.5'>
          <div className='min-w-0'>
            {props.title ? (
              <h2 className='text-console-ink truncate text-sm font-semibold'>
                {props.title}
              </h2>
            ) : null}
            {props.hint ? (
              <p className='text-console-ink-3 mt-0.5 text-xs'>{props.hint}</p>
            ) : null}
          </div>
          {props.actions ? (
            <div className='flex shrink-0 items-center gap-2'>
              {props.actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn('flex-1 px-4 py-3', props.contentClassName)}>
        {props.children}
      </div>
      {props.footer ? (
        <div className='border-console-line bg-console-panel flex flex-wrap items-center justify-end gap-2 border-t px-4 py-2.5'>
          {props.footer}
        </div>
      ) : null}
    </section>
  )
}
