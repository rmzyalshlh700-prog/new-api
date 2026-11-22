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

/**
 * One row that owns every list control: search and filters on the start edge,
 * view actions on the end edge. Keeping them on a single bordered surface
 * removes the scattered boxes and doubled borders of the legacy toolbars.
 */
export function ConsoleToolbar(props: {
  start?: ReactNode
  end?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'bg-console-surface border-console-line flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center sm:gap-3',
        props.className
      )}
    >
      {props.start ? (
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
          {props.start}
        </div>
      ) : null}
      {props.children}
      {props.end ? (
        <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
          {props.end}
        </div>
      ) : null}
    </div>
  )
}
