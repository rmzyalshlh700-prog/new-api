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

export type ConsoleTableCardProps = {
  title?: ReactNode
  hint?: ReactNode
  actions?: ReactNode
  /**
   * Control band pinned under the header (search, filters, view actions).
   * Rendered inside the card frame so a screen never shows a second box.
   */
  toolbar?: ReactNode
  /** Localized pagination or selection summary. */
  footer?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  /** Extra footer classes, e.g. clearance for a floating launcher. */
  footerClassName?: string
}

/**
 * Dense table container. The header, scroll area and footer are three pinned
 * regions of one card, so long tables never push the pagination off screen.
 */
export function ConsoleTableCard(props: ConsoleTableCardProps) {
  return (
    <div
      className={cn(
        'bg-console-surface border-console-line shadow-console-card flex min-h-0 flex-col overflow-hidden rounded-lg border',
        props.className
      )}
    >
      {props.title || props.actions ? (
        <div className='border-console-line flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4'>
          <div className='min-w-0'>
            {props.title ? (
              <div className='text-console-ink truncate text-sm font-semibold'>
                {props.title}
              </div>
            ) : null}
            {props.hint ? (
              <div className='text-console-ink-3 truncate text-xs'>
                {props.hint}
              </div>
            ) : null}
          </div>
          {props.actions ? (
            <div className='flex shrink-0 items-center gap-2'>
              {props.actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {props.toolbar ? (
        <div className='border-console-line shrink-0 border-b'>
          {props.toolbar}
        </div>
      ) : null}
      <div className={cn('min-h-0 flex-1 overflow-auto', props.contentClassName)}>
        {props.children}
      </div>
      {props.footer ? (
        <div
          className={cn(
            'border-console-line text-console-ink-3 flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-xs tabular-nums sm:px-4',
            props.footerClassName
          )}
        >
          {props.footer}
        </div>
      ) : null}
    </div>
  )
}
