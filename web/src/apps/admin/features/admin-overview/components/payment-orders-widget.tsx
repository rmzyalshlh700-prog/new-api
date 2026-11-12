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
import { CheckCircle2, Clock, CreditCard, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { TitledCard } from '@/shared/components/ui/titled-card'
import { formatCurrencyFromUSD } from '@/shared/lib/currency'
import { cn } from '@/shared/lib/utils'

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
  countTextClass: string
}

const BUCKET_CONFIGS: BucketConfig[] = [
  {
    key: 'pending',
    labelKey: 'Pending Payments',
    icon: Clock,
    iconClass: 'text-amber-500',
    countTextClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    key: 'completed',
    labelKey: 'Completed Payments',
    icon: CheckCircle2,
    iconClass: 'text-success',
    countTextClass: 'text-success',
  },
  {
    key: 'failed',
    labelKey: 'Canceled Payments',
    icon: XCircle,
    iconClass: 'text-destructive',
    countTextClass: 'text-destructive',
  },
]

/**
 * Aggregated payment order totals by status. Intentionally shows only the
 * counts and amounts: individual recent orders are read from the payment orders
 * page, which keeps this widget small and cheap to render.
 */
export function PaymentOrdersWidget(props: PaymentOrdersWidgetProps) {
  const { t } = useTranslation()
  const groups = props.groups ?? []

  return (
    <TitledCard
      title={t('Payment Orders')}
      description={t('Payment orders by status')}
      icon={<CreditCard className='size-4' aria-hidden='true' />}
    >
      <div
        className='grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3'
        role='list'
        aria-label={t('Payment Orders')}
      >
        {BUCKET_CONFIGS.map((config) => {
          const group = groups.find((item) => item.key === config.key)
          const Icon = config.icon
          return (
            <div
              key={config.key}
              role='listitem'
              aria-label={t(config.labelKey)}
              className='flex items-center gap-3 rounded-xl border bg-white/50 p-3 shadow-sm dark:bg-white/5'
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
            </div>
          )
        })}
      </div>
    </TitledCard>
  )
}
