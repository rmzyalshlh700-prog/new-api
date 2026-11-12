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
import { Activity, AlertTriangle, Users, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatCard } from '@/apps/client/features/dashboard/components/ui/stat-card'
import { formatInteger, formatQuota } from '@/shared/lib/format'

import type { DashboardMetrics } from '../types'

export interface PlatformMetricsCardsProps {
  metrics: DashboardMetrics | undefined
  loading: boolean
}

export function PlatformMetricsCards(props: PlatformMetricsCardsProps) {
  const { t } = useTranslation()
  const metrics = props.metrics

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      <StatCard
        title={t('Total Registered Users')}
        value={
          metrics ? formatInteger(metrics.registered_users) : '—'
        }
        description={t('Registered users on the platform')}
        icon={Users}
        iconTone='chart-2'
        loading={props.loading}
      />
      <StatCard
        title={t('Total Customer Balances')}
        value={
          metrics ? formatQuota(metrics.total_liabilities_quota) : '—'
        }
        description={t('Sum of all user balances (platform liability)')}
        icon={Wallet}
        iconTone='chart-3'
        loading={props.loading}
      />
      <StatCard
        title={t("Today's Active Visitors")}
        value={
          metrics ? formatInteger(metrics.active_visitors_today) : '—'
        }
        description={t('Unique users with requests or logins today')}
        icon={Activity}
        iconTone='info'
        loading={props.loading}
      />
      <StatCard
        title={t('Failed Requests Today')}
        value={
          metrics ? formatInteger(metrics.failed_requests_today) : '—'
        }
        description={t('Failed API requests logged today')}
        icon={AlertTriangle}
        iconTone='destructive'
        loading={props.loading}
      />
    </div>
  )
}
