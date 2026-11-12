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
import type { StatusVariant } from '@/shared/components/status-badge'

export type TicketStatus = 'open' | 'pending' | 'resolved'
export type TicketPriority = 'low' | 'normal' | 'high'

export type Ticket = {
  id: number
  user_id: number
  username: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  created_at: number
  updated_at: number
}

export type TicketMessage = {
  id: number
  ticket_id: number
  sender_id: number
  is_admin: boolean
  content: string
  is_read: boolean
  created_at: number
}

export type ApiResult<T> = {
  success: boolean
  message?: string
  data?: T
}

export const TICKET_STATUSES: TicketStatus[] = ['open', 'pending', 'resolved']

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'normal', 'high']

export const TICKET_STATUS_BADGES: Record<
  TicketStatus,
  { labelKey: string; variant: StatusVariant }
> = {
  open: { labelKey: 'Open', variant: 'info' },
  pending: { labelKey: 'Pending', variant: 'warning' },
  resolved: { labelKey: 'Resolved', variant: 'success' },
}

export const TICKET_PRIORITY_BADGES: Record<
  TicketPriority,
  { labelKey: string; variant: StatusVariant }
> = {
  low: { labelKey: 'Low', variant: 'neutral' },
  normal: { labelKey: 'Normal', variant: 'info' },
  high: { labelKey: 'High', variant: 'danger' },
}

const FALLBACK_TICKET_BADGE: { labelKey: string; variant: StatusVariant } = {
  labelKey: 'Unknown',
  variant: 'neutral',
}

/**
 * Ticket status/priority arrive from the API as unvalidated strings (they are
 * only cast to the union types at the call sites), so a new backend value
 * must degrade to a neutral badge instead of crashing the ticket list.
 */
export function getTicketStatusBadge(
  status: TicketStatus
): { labelKey: string; variant: StatusVariant } {
  return TICKET_STATUS_BADGES[status] ?? FALLBACK_TICKET_BADGE
}

export function getTicketPriorityBadge(
  priority: TicketPriority
): { labelKey: string; variant: StatusVariant } {
  return TICKET_PRIORITY_BADGES[priority] ?? FALLBACK_TICKET_BADGE
}
