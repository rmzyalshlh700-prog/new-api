import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
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

import { StatCard } from '@/apps/client/features/dashboard/components/ui/stat-card'
import { formatInteger, formatQuota } from '@/shared/lib/format'

import type { DashboardMetrics, ProfitStats } from '../types'

export interface PlatformMetricsCardsProps {
  metrics: DashboardMetrics | undefined
  loading: boolean
  profit?: ProfitStats
  profitLoading?: boolean
  profitError?: boolean
}

/**
 * Identical wrapper to the one used by the standard overview widgets
 * (Revenue / Tokens), so the tiles share the same padding, border,
 * rounding and hover treatment.
 */
function StatCardTile(props: { children: ReactNode }) {
  return (
    <div className='bg-card rounded-2xl border p-3 shadow-xs transition-shadow duration-200 hover:shadow-md sm:p-4'>
      {props.children}
    </div>
  )
}

export function PlatformMetricsCards(props: PlatformMetricsCardsProps) {
  const { t } = useTranslation()
  const metrics = props.metrics

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5'>
      <StatCardTile>
        <StatCard
          title={t('Total Registered Users')}
          value={metrics ? formatInteger(metrics.registered_users) : '—'}
          description={t('Registered users on the platform')}
          icon={Users}
          iconTone='chart-2'
          loading={props.loading}
        />
      </StatCardTile>
      <StatCardTile>
        <StatCard
          title={t('Total Customer Balances')}
          value={metrics ? formatQuota(metrics.total_liabilities_quota) : '—'}
          description={t('Sum of all user balances (platform liability)')}
          icon={Wallet}
          iconTone='chart-3'
          loading={props.loading}
        />
      </StatCardTile>
      <StatCardTile>
        <StatCard
          title={t("Today's Active Visitors")}
          value={metrics ? formatInteger(metrics.active_visitors_today) : '—'}
          description={t('Unique users with requests or logins today')}
          icon={Activity}
          iconTone='info'
          loading={props.loading}
        />
      </StatCardTile>
      <StatCardTile>
        <StatCard
          title={t('Failed Requests Today')}
          value={metrics ? formatInteger(metrics.failed_requests_today) : '—'}
          description={t('Failed API requests logged today')}
          icon={AlertTriangle}
          iconTone='destructive'
          loading={props.loading}
        />
      </StatCardTile>
      <StatCardTile>
        <StatCard
          title={t('Net Profit')}
          value={
            props.profit
              ? formatQuota(props.profit.all_time.net_profit_quota)
              : '—'
          }
          description={
            props.profit
              ? t('Today: {{today}} · This month: {{month}}', {
                  today: formatQuota(props.profit.today.net_profit_quota),
                  month: formatQuota(props.profit.month.net_profit_quota),
                })
              : t('Revenue minus upstream provider cost')
          }
          icon={TrendingUp}
          iconTone='success'
          loading={props.profitLoading ?? false}
          error={props.profitError}
        />
      </StatCardTile>
    </div>
  )
}
