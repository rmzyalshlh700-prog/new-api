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
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/shared/components/copy-button'
import { StatusBadge } from '@/shared/components/status-badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { toIntlLocale } from '@/shared/i18n/languages'
import {
  formatCurrencyFromUSD,
  formatLocalCurrencyAmount,
} from '@/shared/lib/currency'
import { formatTimestampToDate } from '@/shared/lib/format'

import { getPaymentProviderLabel, getPaymentStatusBadge } from '../constants'
import type { PaymentLogEntry } from '../types'

/**
 * One label/value line. The label sits on the inline-start edge and the value on
 * the inline-end edge, so the pair reads correctly in RTL and LTR without any
 * direction-specific classes, and a value is never separated from its label.
 */
function KeyValueRow(props: { label: string; children: ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-3 border-b py-1.5 last:border-0'>
      <span className='text-muted-foreground shrink-0 text-xs'>
        {props.label}
      </span>
      <span className='min-w-0 text-end text-xs font-medium'>
        {props.children}
      </span>
    </div>
  )
}

function PaymentLogMobileCard(props: { entry: PaymentLogEntry }) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { entry } = props
  const status = getPaymentStatusBadge(entry.status, t)

  // The email is the only identifier that can be arbitrarily long; it gets
  // `break-all` so it wraps onto a second line instead of being cut short.
  const identity = entry.user_email || entry.username || `#${entry.user_id}`

  return (
    <div className='bg-card min-w-0 overflow-hidden rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-1'>
            <code
              className='min-w-0 flex-1 truncate font-mono text-[11px] sm:text-xs'
              dir='ltr'
              title={entry.trade_no}
            >
              {entry.trade_no}
            </code>
            <CopyButton
              value={entry.trade_no}
              tooltip={t('Copy transaction reference')}
              aria-label={t('Copy transaction reference')}
              className='h-6 w-6 shrink-0'
              iconClassName='size-3'
            />
          </div>
          <div className='text-muted-foreground mt-0.5 font-mono text-[11px]'>
            {formatTimestampToDate(entry.create_time)}
          </div>
        </div>
        <StatusBadge
          label={status.label}
          variant={status.variant}
          copyable={false}
          className='shrink-0'
        />
      </div>

      <div className='mt-2'>
        <KeyValueRow label={t('User')}>
          <span className='break-all' dir='ltr'>
            {identity}
          </span>
        </KeyValueRow>
        <KeyValueRow label={t('User ID')}>
          <span className='tabular-nums'>{entry.user_id}</span>
        </KeyValueRow>
        <KeyValueRow label={t('Payment gateway')}>
          {getPaymentProviderLabel(entry.payment_provider, t)}
        </KeyValueRow>
        <KeyValueRow label={t('Credited amount')}>
          <span className='tabular-nums'>
            {formatCurrencyFromUSD(entry.amount, {
              digitsLarge: 2,
              digitsSmall: 2,
              abbreviate: false,
              locale,
            })}
          </span>
        </KeyValueRow>
        <KeyValueRow label={t('Paid amount')}>
          <span className='tabular-nums text-red-600'>
            {formatLocalCurrencyAmount(entry.money, {
              digitsLarge: 2,
              digitsSmall: 2,
              abbreviate: false,
              locale,
            })}
          </span>
        </KeyValueRow>
      </div>
    </div>
  )
}

export function PaymentLogsMobileCard(props: {
  entries: PaymentLogEntry[]
  isLoading?: boolean
  emptyTitle: string
  emptyDescription: string
}) {
  if (props.isLoading) {
    return (
      <div className='space-y-2'>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className='bg-card rounded-lg border p-3'>
            <div className='flex items-start justify-between gap-2'>
              <Skeleton className='h-4 w-40' />
              <Skeleton className='h-5 w-16 rounded-md' />
            </div>
            <div className='mt-3 space-y-2'>
              {[1, 2, 3].map((j) => (
                <div key={j} className='flex items-center justify-between'>
                  <Skeleton className='h-3 w-16' />
                  <Skeleton className='h-3 w-24' />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (props.entries.length === 0) {
    return (
      <div className='text-muted-foreground flex min-h-32 flex-col items-center justify-center rounded-lg border p-6 text-center'>
        <p className='text-sm font-medium'>{props.emptyTitle}</p>
        <p className='mt-1 text-xs'>{props.emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      {props.entries.map((entry) => (
        <PaymentLogMobileCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
