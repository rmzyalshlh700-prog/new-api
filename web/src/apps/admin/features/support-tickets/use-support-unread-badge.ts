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
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { toIntlLocale } from '@/shared/i18n/languages'
import { api } from '@/shared/lib/api'
import { formatNumber } from '@/shared/lib/format'
import { createServerError } from '@/shared/lib/server-error-message'

export type SupportUnreadCountResponse = {
  success: boolean
  message?: string
  data?: {
    unread: number
  }
}

export async function fetchAdminUnreadCount(): Promise<SupportUnreadCountResponse> {
  const response = await api.get('/api/user/support/admin/unread_count')
  return response.data
}

const POLL_INTERVAL_MS = 15 * 1000

/**
 * Polls the global unread support-message counter so the sidebar badge and a
 * one-shot toast stay up to date without a websocket.
 */
export function useSupportUnreadBadge(): string | undefined {
  const { t, i18n } = useTranslation()
  const previousCount = useRef<number | null>(null)
  const hasMounted = useRef(false)

  const { data } = useQuery({
    queryKey: ['support-unread-count'],
    queryFn: async () => {
      const result = await fetchAdminUnreadCount()
      if (!result.success) {
        throw createServerError(result, t('Failed to load support tickets'))
      }
      return result.data?.unread ?? 0
    },
    refetchInterval: POLL_INTERVAL_MS,
  })

  const count = data ?? 0

  useEffect(() => {
    if (previousCount.current === null) {
      previousCount.current = count
      return
    }
    if (count > previousCount.current) {
      toast.success(t('New support ticket message'), {
        description: t('A user replied to a support ticket'),
      })
    }
    if (!hasMounted.current) {
      hasMounted.current = true
    }
    previousCount.current = count
  }, [count, t])

  if (count === 0) return undefined
  return formatNumber(count, toIntlLocale(i18n.resolvedLanguage || i18n.language))
}
