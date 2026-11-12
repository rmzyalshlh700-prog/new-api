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
import {
  CheckCircle2,
  Clock,
  CreditCard,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/shared/components/empty-state'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { TitledCard } from '@/shared/components/ui/titled-card'
import { cn } from '@/shared/lib/utils'
import { formatCurrencyFromUSD } from '@/shared/lib/currency'
import { formatTimestampToDate } from '@/shared/lib/format'

import type { PaymentOrderGroup } from '../types'

export interface PaymentOrdersWidgetProps {
  groups: PaymentOrderGroup[] | undefined
  loading: boolean
}

interface BucketConfig {
  key: PaymentOrderGroup['key']
  labelKey: string
  icon: typeof Clock
  iconClass: string
  activeRingClass: string
  countTextClass: string
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    key: 'pending',
    labelKey: 'Pending Payments',
    icon: Clock,
    iconClass: 'text-amber-500',
    activeRingClass: 'ring-amber-500/60 border-amber-500/60',
    countTextClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'completed',
    labelKey: 'Completed Payments',
    icon: CheckCircle2,
    iconClass: 'text-success',
    activeRingClass: 'ring-success/60 border-success/60',
    countTextClass: 'text-success',
  },
  {
    key: 'failed',
    labelKey: 'Canceled Payments',
    icon: XCircle,
    iconClass: 'text-destructive',
    activeRingClass: 'ring-destructive/60 border-destructive/60',
    countTextClass: 'text-destructive',
  },
]

function RecentOrdersList(props: { group: PaymentOrderGroup | null }) {
  const { t } = useTranslation()

  if (!props.group || props.group.recent.length === 0) {
    return <EmptyState title={t('No recent transactions')} />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Username')}</TableHead>
          <TableHead className='text-right'>{t('Amount')}</TableHead>
          <TableHead>{t('Gateway')}</TableHead>
          <TableHead className='text-right'>{t('Time')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.group.recent.map((order) => (
          <TableRow key={order.trade_no}>
            <TableCell className='font-medium'>
              {order.username || t('Unknown user')}
            </TableCell>
            <TableCell className='text-right font-mono tabular-nums'>
              {formatCurrencyFromUSD(order.money)}
            </TableCell>
            <TableCell>
              {order.payment_provider || order.payment_method || '-'}
            </TableCell>
            <TableCell className='text-right text-muted-foreground'>
              {formatTimestampToDate(order.create_time)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function PaymentOrdersWidget(props: PaymentOrdersWidgetProps) {
  const { t } = useTranslation()
  const [selectedKey, setSelectedKey] =
    useState<PaymentOrderGroup['key']>('pending')

  const groups = props.groups ?? []
  const selectedGroup =
    groups.find((group) => group.key === selectedKey) ?? null

  return (
    <TitledCard
      title={t('Payment Orders')}
      description={t('Payment orders by status')}
      icon={<CreditCard className='size-4' aria-hidden='true' />}
    >
      <div
        className='grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3'
        role='tablist'
        aria-label={t('Payment Orders')}
      >
        {BUCKET_CONFIGS.map((config) => {
          const group = groups.find((item) => item.key === config.key)
          const isActive = selectedKey === config.key
          const Icon = config.icon
          return (
            <button
              key={config.key}
              type='button'
              role='tab'
              aria-selected={isActive}
              aria-label={t(config.labelKey)}
              onClick={() => setSelectedKey(config.key)}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-white/50 p-3 text-left shadow-sm transition-colors dark:bg-white/5',
                'hover:bg-white/80 dark:hover:bg-white/10',
                isActive && `ring-2 ${config.activeRingClass}`
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted',
                  config.iconClass
                )}
              >
                <Icon className='size-4.5' aria-hidden='true' />
              </span>
              <span className='min-w-0'>
                <span className='text-muted-foreground block truncate text-xs'>
                  {t(config.labelKey)}
                </span>
                {props.loading ? (
                  <Skeleton className='mt-1 h-5 w-12' />
                ) : (
                  <span
                    className={cn(
                      'block text-lg font-semibold tabular-nums',
                      config.countTextClass
                    )}
                  >
                    {group ? group.count : 0}
                  </span>
                )}
                {props.loading ? (
                  <Skeleton className='mt-1 h-3.5 w-16' />
                ) : (
                  <span className='text-muted-foreground block truncate text-xs tabular-nums'>
                    {formatCurrencyFromUSD(group?.amount ?? 0)}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className='mt-3' role='tabpanel'>
        {props.loading ? (
          <div className='space-y-2'>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className='h-10 w-full' />
            ))}
          </div>
        ) : (
          <RecentOrdersList group={selectedGroup} />
        )}
      </div>
    </TitledCard>
  )
}
