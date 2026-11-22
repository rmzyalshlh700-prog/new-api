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
import { Coins, Cpu, KeyRound, Users, Wallet, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatCard } from '@/apps/client/features/dashboard/components/ui/stat-card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { toIntlLocale } from '@/shared/i18n/languages'
import { formatLogQuota, formatNumber } from '@/shared/lib/format'

import type { DailyArchive } from '../api'

interface ArchiveSummaryCardsProps {
  summary: DailyArchive | null
  loading: boolean
}

/**
 * Top-of-page KPI cards for one archived day: revenue, net profit, requests,
 * tokens, new API keys and new users. Layout is RTL-safe: it uses logical
 * grid ordering only, no directional margins.
 */
export function ArchiveSummaryCards({ summary, loading }: ArchiveSummaryCardsProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  if (loading && !summary) {
    return (
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-28 rounded-2xl' />
        ))}
      </div>
    )
  }

  if (!summary) return null

  const netProfit = summary.total_revenue - summary.total_cost

  const cards = [
    {
      title: t('Revenue'),
      value: formatLogQuota(summary.total_revenue),
      icon: Wallet,
      tone: 'accent-1' as const,
    },
    {
      title: t('Net Profit'),
      value: formatLogQuota(netProfit),
      icon: TrendingUp,
      tone: 'accent-2' as const,
    },
    {
      title: t('Requests'),
      value: formatNumber(summary.total_requests, locale),
      icon: Coins,
      tone: 'accent-3' as const,
    },
    {
      title: t('Tokens'),
      value: formatNumber(summary.total_tokens, locale),
      icon: Cpu,
      tone: 'accent-1' as const,
    },
    {
      title: t('New API Keys'),
      value: formatNumber(summary.new_api_keys, locale),
      icon: KeyRound,
      tone: 'accent-2' as const,
    },
    {
      title: t('New Users'),
      value: formatNumber(summary.new_users, locale),
      icon: Users,
      tone: 'accent-3' as const,
    },
  ]

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      {cards.map((card) => (
        <div
          key={card.title}
          className='bg-card rounded-2xl border p-3 shadow-xs transition-shadow duration-200 hover:shadow-md sm:p-4'
        >
          <StatCard
            title={card.title}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
          />
        </div>
      ))}
    </div>
  )
}
