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
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare } from 'lucide-react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { StatusBadge } from '@/shared/components/status-badge'
import { SectionPageLayout } from '@/shared/components/layout'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createServerError } from '@/shared/lib/server-error-message'
import { handleServerError } from '@/shared/lib/handle-server-error'
import { formatTimestampToDate } from '@/shared/lib/format'

import { adminGetTickets, adminUpdateTicketStatus } from './api'
import { TicketChat } from './ticket-chat'
import {
  TICKET_PRIORITY_BADGES,
  TICKET_STATUSES,
  TICKET_STATUS_BADGES,
  type Ticket,
  type TicketStatus,
} from './types'

const PAGE_SIZE = 50

export function SupportTickets() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-support-tickets', statusFilter],
    queryFn: async () => {
      const result = await adminGetTickets(statusFilter, 1, PAGE_SIZE)
      if (!result.success) {
        throw createServerError(result, t('Failed to load support tickets'))
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    refetchInterval: 15 * 1000,
  })

  const tickets = data?.items ?? []

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['admin-support-tickets'] })
    void queryClient.invalidateQueries({ queryKey: ['support-unread-count'] })
  }, [queryClient])

  const handleStatusChange = async (ticket: Ticket, status: TicketStatus) => {
    try {
      const result = await adminUpdateTicketStatus(ticket.id, status)
      if (result.success) {
        refresh()
      } else {
        handleServerError(result, t('Failed to update ticket status'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to update ticket status'))
    }
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Support Tickets')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <div className='flex items-center gap-2'>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value ?? 'all')}
            >
              <SelectTrigger className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('All')}</SelectItem>
                {TICKET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(TICKET_STATUS_BADGES[status].labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className='text-muted-foreground py-10 text-center text-sm'>
              {t('Loading...')}
            </div>
          )}
          {!isLoading && tickets.length === 0 && (
            <Empty className='border-dashed'>
              <EmptyHeader>
                <EmptyTitle>{t('No support tickets yet')}</EmptyTitle>
                <EmptyDescription>
                  {t('Tickets opened by users will appear here.')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!isLoading && tickets.length > 0 && (
            <div className='overflow-hidden rounded-lg border'>
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className='flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0'
                >
                  <div className='min-w-0 flex-1'>
                    <button
                      type='button'
                      className='hover:text-primary truncate text-start text-sm font-medium'
                      onClick={() => setActiveTicketId(ticket.id)}
                    >
                      #{ticket.id} · {ticket.subject}
                    </button>
                    <p className='text-muted-foreground mt-0.5 text-xs'>
                      {ticket.username} ·{' '}
                      {formatTimestampToDate(ticket.updated_at)}
                    </p>
                  </div>
                  <StatusBadge
                    label={t(TICKET_STATUS_BADGES[ticket.status].labelKey)}
                    variant={TICKET_STATUS_BADGES[ticket.status].variant}
                    size='sm'
                  />
                  <StatusBadge
                    label={t(TICKET_PRIORITY_BADGES[ticket.priority].labelKey)}
                    variant={TICKET_PRIORITY_BADGES[ticket.priority].variant}
                    size='sm'
                  />
                  <Select
                    value={ticket.status}
                    onValueChange={(value) =>
                      void handleStatusChange(ticket, value as TicketStatus)
                    }
                  >
                    <SelectTrigger size='sm' className='w-36'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(TICKET_STATUS_BADGES[status].labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='gap-1.5'
                    onClick={() => setActiveTicketId(ticket.id)}
                  >
                    <MessageSquare className='size-4' aria-hidden='true' />
                    {t('Reply')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <TicketChat
          ticketId={activeTicketId}
          isAdmin={true}
          onOpenChange={(open) => {
            if (!open) setActiveTicketId(null)
          }}
          onActivity={refresh}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
