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
  Activity,
  AlertTriangle,
  KeyRound,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatCard } from '@/apps/client/features/dashboard/components/ui/stat-card'
import {
  formatDashboardQuota,
  formatInteger,
} from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

import type { DashboardMetrics, ProfitStats } from '../types'

export interface PlatformMetricsCardsProps {
  metrics: DashboardMetrics | undefined
  loading: boolean
  profit?: ProfitStats
  profitLoading?: boolean
  profitError?: boolean
}

function StatCardTile(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-card border-border/60 rounded-xl border p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:rounded-2xl sm:p-4',
        props.className
      )}
    >
      {props.children}
    </div>
  )
}

/**
 * Platform health at a glance. The failed-request tile keeps its provider /
 * rejection split, so on a phone it takes the full row while the four single
 * figures sit two per row.
 */
export function PlatformMetricsCards(props: PlatformMetricsCardsProps) {
  const { t } = useTranslation()
  const metrics = props.metrics

  return (
    <div className='grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5'>
      <StatCardTile>
        <StatCard
          title={t('Total Registered Users')}
          value={metrics ? formatInteger(metrics.registered_users) : '—'}
          description={t('Registered users on the platform')}
          icon={Users}
          iconTone='chart-2'
          compactMobile
          loading={props.loading}
        />
      </StatCardTile>
      <StatCardTile>
        <StatCard
          title={t('API Keys Created Today')}
          value={metrics ? formatInteger(metrics.api_keys_created_today) : '—'}
          description={
            metrics
              ? t('Total API keys: {{total}}', {
                  total: formatInteger(metrics.api_keys_total),
                })
              : t('API keys users created today')
          }
          icon={KeyRound}
          iconTone='chart-3'
          compactMobile
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
          compactMobile
          loading={props.loading}
        />
      </StatCardTile>
      <StatCardTile>
        <StatCard
          title={t('Net Profit')}
          value={
            props.profit
              ? formatDashboardQuota(props.profit.all_time.net_profit_quota)
              : '—'
          }
          description={
            props.profit
              ? t('Today: {{today}} · This month: {{month}}', {
                  today: formatDashboardQuota(
                    props.profit.today.net_profit_quota
                  ),
                  month: formatDashboardQuota(
                    props.profit.month.net_profit_quota
                  ),
                })
              : t('Revenue minus upstream provider cost')
          }
          icon={TrendingUp}
          iconTone='success'
          compactMobile
          loading={props.profitLoading ?? false}
          error={props.profitError}
        />
      </StatCardTile>
      <StatCardTile className='col-span-2 sm:col-span-1'>
        <StatCard
          title={t('Failed Requests Today')}
          value={metrics ? formatInteger(metrics.failed_requests_today) : '—'}
          description={t('Failed API requests logged today')}
          // The total splits by where the request failed: a provider that
          // refused or broke, or a request rejected before one was chosen.
          details={
            metrics
              ? [
                  {
                    label: t('From model providers'),
                    value: formatInteger(metrics.provider_errors_today),
                    tone: 'destructive',
                  },
                  {
                    label: t('Rejected before a provider'),
                    value: formatInteger(metrics.rejected_requests_today),
                    tone: 'muted',
                  },
                ]
              : undefined
          }
          icon={AlertTriangle}
          iconTone='destructive'
          loading={props.loading}
        />
      </StatCardTile>
    </div>
  )
}
