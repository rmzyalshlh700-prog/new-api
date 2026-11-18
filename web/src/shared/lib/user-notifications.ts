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
import { api } from '@/shared/lib/api'
import { requireServerSuccess } from '@/shared/lib/server-error-message'

export type UserNotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface UserNotification {
  id: number
  user_id: number
  title: string
  content: string
  level: UserNotificationLevel
  category: string
  link: string
  source: string
  created_by: number
  created_at: number
  read_at: number
}

export interface UserNotificationPage {
  items: UserNotification[]
  total: number
  unread: number
  page: number
  page_size: number
}

export interface GetMyNotificationsParams {
  page?: number
  page_size?: number
  unread?: boolean
  keyword?: string
}

/** Read one page of the signed-in user's own notification inbox. */
export async function getMyNotifications(
  params: GetMyNotificationsParams = {}
): Promise<UserNotificationPage> {
  const res = await api.get('/api/user/notifications', {
    params: {
      p: params.page ?? 1,
      page_size: params.page_size ?? 20,
      unread: params.unread ? 'true' : undefined,
      keyword: params.keyword || undefined,
    },
  })
  const body = requireServerSuccess(res.data)
  return (body?.data ?? {
    items: [],
    total: 0,
    unread: 0,
    page: 1,
    page_size: 20,
  }) as UserNotificationPage
}

/** Mark specific notifications read, or the whole inbox when all is true. */
export async function markMyNotificationsRead(payload: {
  ids?: number[]
  all?: boolean
}): Promise<{ updated: number; unread: number }> {
  const res = await api.post('/api/user/notifications/read', payload)
  const body = requireServerSuccess(res.data)
  return (body?.data ?? { updated: 0, unread: 0 }) as {
    updated: number
    unread: number
  }
}

/** Remove one notification from the signed-in user's inbox. */
export async function dismissMyNotification(
  id: number
): Promise<{ unread: number }> {
  const res = await api.post('/api/user/notifications/dismiss', { id })
  const body = requireServerSuccess(res.data)
  return (body?.data ?? { unread: 0 }) as { unread: number }
}
