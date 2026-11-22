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
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/shared/components/copy-button'
import { StatusBadge } from '@/shared/components/status-badge'
import { toIntlLocale } from '@/shared/i18n/languages'
import {
  formatCurrencyFromUSD,
  formatLocalCurrencyAmount,
} from '@/shared/lib/currency'
import { formatTimestampToDate } from '@/shared/lib/format'

import { getPaymentProviderLabel, getPaymentStatusBadge } from '../constants'
import type { PaymentLogEntry } from '../types'

export function usePaymentLogColumns(): ColumnDef<PaymentLogEntry>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return useMemo<ColumnDef<PaymentLogEntry>[]>(
    () => [
      {
        accessorKey: 'trade_no',
        header: t('Transaction Reference'),
        meta: { mobileTitle: true },
        cell: ({ row }) => (
          <div className='flex w-full min-w-0 items-center gap-1 overflow-hidden'>
            <span
              className='min-w-0 flex-1 truncate font-mono text-xs sm:text-sm'
              title={row.original.trade_no}
              dir='ltr'
            >
              {row.original.trade_no}
            </span>
            <CopyButton
              value={row.original.trade_no}
              tooltip={t('Copy transaction reference')}
              aria-label={t('Copy transaction reference')}
              className='h-6 w-6'
              iconClassName='size-3.5'
            />
          </div>
        ),
        size: 280,
      },
      {
        accessorKey: 'user_email',
        header: t('User'),
        meta: { mobileOrder: 20 },
        cell: ({ row }) => {
          const entry = row.original
          const primary =
            entry.user_email || entry.username || `#${entry.user_id}`
          return (
            <div className='flex min-w-0 flex-col gap-0.5 overflow-hidden'>
              <span
                className='truncate text-sm font-medium'
                dir='ltr'
                title={primary}
              >
                {primary}
              </span>
              <span className='text-muted-foreground truncate text-[10px] leading-tight tabular-nums whitespace-nowrap'>
                {t('User ID')}: {entry.user_id}
              </span>
            </div>
          )
        },
        size: 230,
      },
      {
        accessorKey: 'payment_provider',
        header: t('Payment gateway'),
        meta: { mobileOrder: 30 },
        cell: ({ row }) => {
          const entry = row.original
          // `payment_method` is usually the provider id repeated verbatim, so
          // printing it under the label only repeated "NOWPayments /
          // nowpayments". Show the second line only when it differs.
          const method = (entry.payment_method || '').trim()
          const duplicatesProvider =
            !method ||
            method.toLowerCase() ===
              (entry.payment_provider || '').trim().toLowerCase()
          return (
            <div className='flex min-w-0 flex-col gap-0.5 overflow-hidden'>
              <span className='truncate text-sm font-medium'>
                {getPaymentProviderLabel(entry.payment_provider, t)}
              </span>
              {!duplicatesProvider && (
                <span className='text-muted-foreground truncate text-[10px] leading-tight'>
                  {method}
                </span>
              )}
            </div>
          )
        },
        filterFn: (row, id, value) =>
          (value as string[]).includes(String(row.getValue(id))),
        size: 140,
      },
      {
        accessorKey: 'amount',
        header: t('Credited amount'),
        meta: { mobileOrder: 40 },
        cell: ({ row }) => {
          const entry = row.original
          const credited = formatCurrencyFromUSD(entry.amount, {
            digitsLarge: 2,
            digitsSmall: 2,
            abbreviate: false,
            locale,
          })
          const paid = formatLocalCurrencyAmount(entry.money, {
            digitsLarge: 2,
            digitsSmall: 2,
            abbreviate: false,
            locale,
          })
          // Credited and paid coincide whenever the group ratio is 1, which is
          // the normal case; repeating the same figure under a second label is
          // what made the card unreadable. The paid figure still appears when
          // it genuinely differs (discounts, group ratios, partial payments).
          const differs = Number(entry.money) !== Number(entry.amount)
          return (
            <div className='flex min-w-0 flex-col gap-0.5 overflow-hidden'>
              <span
                className='truncate text-sm font-semibold tabular-nums whitespace-nowrap'
                dir='ltr'
              >
                {credited}
              </span>
              {differs && (
                <span
                  className='text-muted-foreground truncate text-[10px] leading-tight tabular-nums whitespace-nowrap'
                  dir='ltr'
                >
                  {t('Paid')}: {paid}
                </span>
              )}
            </div>
          )
        },
        size: 140,
      },
      {
        accessorKey: 'money',
        header: t('Paid amount'),
        // The card shows the paid figure inside the amount cell, and only when
        // it differs, so this column is desktop-only.
        meta: { mobileOrder: 50, mobileHidden: true },
        cell: ({ row }) => (
          <span
            className='block truncate text-sm tabular-nums whitespace-nowrap'
            dir='ltr'
          >
            {/* The gateway stores paid amounts in the local billing currency
                (never tokens), so format them with the billing-currency
                formatter instead of a bare number. */}
            {formatLocalCurrencyAmount(row.original.money, {
              digitsLarge: 2,
              digitsSmall: 2,
              abbreviate: false,
              locale,
            })}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        meta: { mobileBadge: true },
        cell: ({ row }) => {
          const badge = getPaymentStatusBadge(row.original.status, t)
          return (
            <StatusBadge
              label={badge.label}
              variant={badge.variant}
              copyable={false}
              className='-ms-1.5'
            />
          )
        },
        filterFn: (row, id, value) =>
          (value as string[]).includes(String(row.getValue(id))),
        size: 110,
      },
      {
        accessorKey: 'create_time',
        header: t('Created At'),
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <div
            className='min-w-0 font-mono text-sm whitespace-nowrap'
            dir='ltr'
          >
            {/* Fixed Gregorian tokens; never rendered through a locale calendar. */}
            {formatTimestampToDate(row.original.create_time)}
          </div>
        ),
        size: 170,
      },
    ],
    [t, locale]
  )
}
