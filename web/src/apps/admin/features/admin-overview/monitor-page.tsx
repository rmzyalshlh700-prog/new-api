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
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConsoleKpiStrip } from '@/shared/components/console'
import { SectionPageLayout } from '@/shared/components/layout'
import {
  formatCompactNumber,
  formatDashboardQuota,
  formatInteger,
} from '@/shared/lib/format'
import { requireServerSuccess } from '@/shared/lib/server-error-message'
import { getStartOfDay } from '@/shared/lib/time'

import { getAdminDashboardMetrics, getAdminQuotaRows } from './api'
import { MonitorCenter } from './components/monitor-center'
import { LIVE_REFRESH_MS } from './constants'
import { sumUsageSince } from './lib/aggregate'

const MONITOR_WINDOW_DAYS = 30

/**
 * Monitor Center screen.
 *
 * Same live admin endpoints as the overview widgets, isolated on its own page
 * so operators can watch traffic, health and throughput without the dashboard
 * cards underneath.
 */
export function AdminMonitor() {
  const { t } = useTranslation()
  const [now] = useState(() => new Date())
  const nowSeconds = Math.floor(now.getTime() / 1000)
  const todayStart = Math.floor(getStartOfDay(now).getTime() / 1000)
  const windowStart = nowSeconds - MONITOR_WINDOW_DAYS * 24 * 60 * 60

  const quotaQuery = useQuery({
    queryKey: ['admin-monitor', 'quota', windowStart],
    queryFn: async () =>
      requireServerSuccess(
        await getAdminQuotaRows({
          start_timestamp: windowStart,
          end_timestamp: nowSeconds + 3600,
        })
      ),
    refetchInterval: LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: LIVE_REFRESH_MS - 100,
  })

  const metricsQuery = useQuery({
    queryKey: ['admin-monitor', 'platform-metrics'],
    queryFn: async () => requireServerSuccess(await getAdminDashboardMetrics()),
    refetchInterval: LIVE_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: LIVE_REFRESH_MS - 100,
  })

  const rows = useMemo(() => quotaQuery.data?.data ?? [], [quotaQuery.data])
  const totalsToday = useMemo(
    () => sumUsageSince(rows, todayStart),
    [rows, todayStart]
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Monitor Center')}</SectionPageLayout.Title>
      <SectionPageLayout.Hint>
        {t('Live traffic, health and throughput across the gateway.')}
      </SectionPageLayout.Hint>
      <SectionPageLayout.Actions>
        <span className='text-console-ink-3 flex items-center gap-1.5 text-xs'>
          {!quotaQuery.isError && (
            <span
              className='size-1.5 rounded-full bg-emerald-500'
              aria-hidden='true'
            />
          )}
          {quotaQuery.isError
            ? t('Failed to load')
            : t('Live data, refreshed every {{seconds}} seconds', {
                seconds: LIVE_REFRESH_MS / 1000,
              })}
        </span>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-2.5 sm:gap-4'>
          <ConsoleKpiStrip
            items={[
              {
                label: t('Requests'),
                hint: t('Today'),
                value: formatInteger(totalsToday.requests),
              },
              {
                label: t('Tokens'),
                hint: t('Today'),
                value: formatCompactNumber(totalsToday.tokens),
              },
              {
                label: t('Revenue'),
                hint: t('Today'),
                value: formatDashboardQuota(totalsToday.quota),
              },
              {
                label: t('Active visitors'),
                hint: t('Today'),
                value: formatInteger(
                  metricsQuery.data?.data?.active_visitors_today ?? 0
                ),
              },
            ]}
          />
          <MonitorCenter
            rows={rows}
            metrics={metricsQuery.data?.data}
            requestsToday={totalsToday.requests}
            loading={quotaQuery.isLoading}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
