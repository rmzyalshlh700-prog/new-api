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

export type ConsolePageHeaderProps = {
  /** Page name, rendered as the single h1 of the screen. */
  title: ReactNode
  /** One concise line of context. Longer copy belongs in the page body. */
  hint?: ReactNode
  /** Primary/secondary actions, pinned to the end edge. */
  actions?: ReactNode
  /** Secondary row (tabs, filters) that belongs to the header block. */
  children?: ReactNode
  className?: string
}

/**
 * Compact executive page header: title and hint on the start edge, actions on
 * the end edge. Every console screen opens with exactly one of these, so page
 * titles never drift in size, spacing or alignment between modules.
 */
export function ConsolePageHeader(props: ConsolePageHeaderProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', props.className)}>
      <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-2'>
        <div className='min-w-0 flex-1'>
          <h1 className='text-console-ink truncate text-[15px] leading-6 font-semibold tracking-tight'>
            {props.title}
          </h1>
          {props.hint ? (
            <p className='text-console-ink-3 mt-0.5 truncate text-xs leading-5'>
              {props.hint}
            </p>
          ) : null}
        </div>
        {props.actions ? (
          <div className='flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2'>
            {props.actions}
          </div>
        ) : null}
      </div>
      {props.children}
    </div>
  )
}
