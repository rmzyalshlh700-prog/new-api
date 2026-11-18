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
 * One invoice-style `label … value` line, shared by the admin payment ledger
 * card and the user's own top-up history so the two look identical.
 *
 * The label sits on the inline-start edge and the value on the inline-end edge
 * via logical properties, so RTL and LTR both read correctly with no
 * direction-specific classes. `justify-between` keeps a value beside its own
 * label — a two-column grid used to scatter them apart.
 */
export function DetailRow(props: {
  label: ReactNode
  children: ReactNode
  className?: string
  valueClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b py-2 last:border-0',
        props.className
      )}
    >
      <span className='text-muted-foreground shrink-0 text-xs'>
        {props.label}
      </span>
      <span
        className={cn('min-w-0 text-end text-xs font-medium', props.valueClassName)}
      >
        {props.children}
      </span>
    </div>
  )
}
