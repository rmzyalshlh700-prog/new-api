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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Field,
  FieldLabel,
} from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { StatusBadge } from '@/shared/components/status-badge'
import { SectionPageLayout } from '@/shared/components/layout'
import { useStatus } from '@/shared/hooks/use-status'
import { createServerError } from '@/shared/lib/server-error-message'
import { handleServerError } from '@/shared/lib/handle-server-error'
import { formatTimestampToDate } from '@/shared/lib/format'

import { userCreateTicket, userGetTickets } from './api'
import { TicketChat } from './ticket-chat'
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_BADGES,
  TICKET_STATUS_BADGES,
  type TicketPriority,
} from '@/apps/admin/features/support-tickets/types'

export function ClientSupport() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { status } = useStatus()
  const supportEnabled = status?.support_tickets_enabled !== false

  const [createOpen, setCreateOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['user-support-tickets'],
    queryFn: async () => {
      const result = await userGetTickets(1, 50)
      if (!result.success) {
        throw createServerError(result, t('Failed to load support tickets'))
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    enabled: supportEnabled,
    refetchInterval: 15 * 1000,
  })

  const tickets = data?.items ?? []

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['user-support-tickets'] })
    void queryClient.invalidateQueries({ queryKey: ['support-unread-count'] })
  }, [queryClient])

  const handleCreate = async () => {
    if (!subject.trim() || !content.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await userCreateTicket(
        subject.trim(),
        priority,
        content.trim()
      )
      if (result.success) {
        toast.success(t('Ticket created'))
        setCreateOpen(false)
        setSubject('')
        setPriority('normal')
        setContent('')
        refresh()
      } else {
        handleServerError(result, t('Failed to create ticket'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to create ticket'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!supportEnabled) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Support')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t('Support system is not enabled')}</EmptyTitle>
              <EmptyDescription>
                {t('The support ticket system has been disabled by the administrator.')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Support')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-muted-foreground text-sm'>
              {t('Open a ticket and our team will reply as soon as possible.')}
            </p>
            <Button
              type='button'
              size='sm'
              className='gap-1.5'
              onClick={() => setCreateOpen(true)}
            >
              <Plus className='size-4' aria-hidden='true' />
              {t('New Ticket')}
            </Button>
          </div>

          {isLoading && (
            <div className='text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm'>
              <Loader2 className='size-4 animate-spin' />
              {t('Loading...')}
            </div>
          )}
          {!isLoading && tickets.length === 0 && (
            <Empty className='border-dashed'>
              <EmptyHeader>
                <EmptyTitle>{t('No support tickets yet')}</EmptyTitle>
                <EmptyDescription>
                  {t('Open your first ticket and we will get back to you.')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {!isLoading && tickets.length > 0 && (
            <div className='overflow-hidden rounded-lg border'>
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type='button'
                  className='flex w-full flex-wrap items-center gap-3 border-b px-4 py-3 text-start last:border-b-0 hover:bg-muted/50'
                  onClick={() => setActiveTicketId(ticket.id)}
                >
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                      #{ticket.id} · {ticket.subject}
                    </p>
                    <p className='text-muted-foreground mt-0.5 text-xs'>
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
                </button>
              ))}
            </div>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>{t('New Ticket')}</DialogTitle>
              <DialogDescription>
                {t('Describe your issue and our team will help you resolve it.')}
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4'>
              <Field>
                <FieldLabel>{t('Subject')}</FieldLabel>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={120}
                  placeholder={t('Briefly describe your issue')}
                />
              </Field>
              <Field>
                <FieldLabel>{t('Priority')}</FieldLabel>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as TicketPriority)}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(TICKET_PRIORITY_BADGES[value].labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('Message')}</FieldLabel>
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={4000}
                  rows={6}
                  placeholder={t('Type your message')}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setCreateOpen(false)}
              >
                {t('Cancel')}
              </Button>
              <Button
                type='button'
                onClick={() => void handleCreate()}
                disabled={isSubmitting || !subject.trim() || !content.trim()}
              >
                {isSubmitting && <Loader2 className='size-4 animate-spin' />}
                {t('Submit')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TicketChat
          ticketId={activeTicketId}
          isAdmin={false}
          onOpenChange={(open) => {
            if (!open) setActiveTicketId(null)
          }}
          onActivity={refresh}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
