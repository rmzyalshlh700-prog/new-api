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

import type {
  ApiResult,
  Ticket,
  TicketMessage,
  TicketStatus,
} from '@/apps/admin/features/support-tickets/types'

export type TicketListResponse = ApiResult<{
  items: Ticket[]
  total: number
}>

export type TicketDetailResponse = ApiResult<{
  ticket: Ticket
  messages: TicketMessage[]
}>

export async function adminGetTickets(
  status: string,
  page: number,
  pageSize: number
): Promise<TicketListResponse> {
  const response = await api.get('/api/user/support/admin/tickets', {
    params: { status, p: page, page_size: pageSize },
  })
  return response.data
}

export async function adminGetTicketMessages(
  ticketId: number
): Promise<TicketDetailResponse> {
  const response = await api.get(
    `/api/user/support/admin/tickets/${ticketId}/messages`
  )
  return response.data
}

export async function adminReplyTicket(
  ticketId: number,
  content: string
): Promise<ApiResult<TicketMessage>> {
  const response = await api.post(
    `/api/user/support/admin/tickets/${ticketId}/messages`,
    { content }
  )
  return response.data
}

export async function adminUpdateTicketStatus(
  ticketId: number,
  status: TicketStatus
): Promise<ApiResult<null>> {
  const response = await api.put(
    `/api/user/support/admin/tickets/${ticketId}/status`,
    { status }
  )
  return response.data
}

export async function userGetTickets(
  page: number,
  pageSize: number
): Promise<TicketListResponse> {
  const response = await api.get('/api/user/support/tickets', {
    params: { p: page, page_size: pageSize },
  })
  return response.data
}

export async function userCreateTicket(
  subject: string,
  priority: string,
  content: string
): Promise<ApiResult<Ticket>> {
  const response = await api.post('/api/user/support/tickets', {
    subject,
    priority,
    content,
  })
  return response.data
}

export async function userGetTicketMessages(
  ticketId: number
): Promise<TicketDetailResponse> {
  const response = await api.get(`/api/user/support/tickets/${ticketId}/messages`)
  return response.data
}

export async function userReplyTicket(
  ticketId: number,
  content: string
): Promise<ApiResult<TicketMessage>> {
  const response = await api.post(
    `/api/user/support/tickets/${ticketId}/messages`,
    { content }
  )
  return response.data
}
