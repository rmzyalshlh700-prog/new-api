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

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface ResolvedNotificationTarget {
  id: number
  username: string
  display_name: string
  email: string
  status: number
  role: number
  group: string
}

export interface SendNotificationPayload {
  account: string
  title: string
  content?: string
  level?: NotificationLevel
  category?: string
  link?: string
  deliver_external?: boolean
}

export interface SentNotification {
  id: number
  user_id: number
  title: string
  content: string
  level: NotificationLevel
  category: string
  link: string
  source: string
  created_by: number
  created_at: number
  read_at: number
  username: string
  display_name: string
  email: string
  read: boolean
}

export interface SendNotificationResult {
  notification: SentNotification
  recipient: {
    id: number
    username: string
    display_name: string
    email: string
  }
  external: { attempted: boolean; delivered: boolean; message: string }
}

export interface SentNotificationPage {
  items: SentNotification[]
  total: number
  page: number
  page_size: number
}

/** Preview which single account an identifier resolves to. */
export async function resolveNotificationTarget(
  account: string,
  signal?: AbortSignal
): Promise<ResolvedNotificationTarget> {
  const res = await api.get('/api/user/notifications/target', {
    params: { account },
    signal,
  })
  const body = requireServerSuccess(res.data)
  return body.data as ResolvedNotificationTarget
}

/** Send one notification to exactly one resolved account. */
export async function sendUserNotification(
  payload: SendNotificationPayload
): Promise<SendNotificationResult> {
  const res = await api.post('/api/user/notifications/send', payload)
  const body = requireServerSuccess(res.data)
  return body.data as SendNotificationResult
}

/** The notifications administrators sent, newest first. */
export async function getSentNotifications(params: {
  keyword?: string
  page?: number
  page_size?: number
}): Promise<SentNotificationPage> {
  const res = await api.get('/api/user/notifications/sent', {
    params: {
      keyword: params.keyword || undefined,
      p: params.page ?? 1,
      page_size: params.page_size ?? 20,
    },
  })
  const body = requireServerSuccess(res.data)
  return (body?.data ?? {
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  }) as SentNotificationPage
}

/** Recall a notification, removing it from the recipient's inbox. */
export async function revokeNotification(id: number): Promise<void> {
  const res = await api.post('/api/user/notifications/revoke', { id })
  requireServerSuccess(res.data)
}
