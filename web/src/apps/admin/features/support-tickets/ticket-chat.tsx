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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Send } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { StatusBadge } from '@/shared/components/status-badge'
import { Textarea } from '@/shared/components/ui/textarea'
import { handleServerError } from '@/shared/lib/handle-server-error'
import { formatTimestampToDate } from '@/shared/lib/format'

import {
  adminGetTicketMessages,
  adminReplyTicket,
  userGetTicketMessages,
  userReplyTicket,
} from './api'
import {
  TICKET_PRIORITY_BADGES,
  TICKET_STATUS_BADGES,
  type Ticket,
  type TicketMessage,
} from './types'

type TicketChatProps = {
  ticketId: number | null
  isAdmin: boolean
  onOpenChange: (open: boolean) => void
  onActivity: () => void
}

export function TicketChat({
  ticketId,
  isAdmin,
  onOpenChange,
  onActivity,
}: TicketChatProps) {
  const { t } = useTranslation()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [content, setContent] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const open = ticketId !== null

  const loadMessages = async () => {
    if (ticketId === null) return
    setIsLoading(true)
    try {
      const result = isAdmin
        ? await adminGetTicketMessages(ticketId)
        : await userGetTicketMessages(ticketId)
      if (result.success && result.data) {
        setTicket(result.data.ticket)
        setMessages(result.data.messages)
      } else {
        handleServerError(result, t('Failed to load support tickets'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to load support tickets'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setContent('')
      void loadMessages()
    } else {
      setTicket(null)
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, isAdmin])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // While the chat is open, keep the conversation fresh so both sides see
  // each other's replies without leaving the window.
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => {
      void loadMessages()
    }, 15 * 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketId, isAdmin])

  const handleSend = async () => {
    if (!ticketId || !content.trim() || isSending) return
    setIsSending(true)
    try {
      const result = isAdmin
        ? await adminReplyTicket(ticketId, content.trim())
        : await userReplyTicket(ticketId, content.trim())
      if (result.success) {
        setContent('')
        await loadMessages()
        onActivity()
      } else {
        handleServerError(result, t('Failed to send message'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to send message'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'>
        <DialogHeader className='border-b px-5 py-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <DialogTitle className='me-2 truncate'>
              {ticket?.subject ?? '...'}
            </DialogTitle>
            {ticket && (
              <>
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
              </>
            )}
          </div>
          {isAdmin && ticket?.username && (
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('User')}: {ticket.username}
            </p>
          )}
        </DialogHeader>
        <ScrollArea className='flex-1 px-5 py-4'>
          {isLoading && messages.length === 0 ? (
            <div className='text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm'>
              <Loader2 className='size-4 animate-spin' />
              {t('Loading...')}
            </div>
          ) : (
            <div className='space-y-3'>
              {messages.map((message) => {
                const own = message.is_admin === isAdmin
                return (
                  <div
                    key={message.id}
                    className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] space-y-1 rounded-2xl px-4 py-2.5 text-sm ${
                        own
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className='whitespace-pre-wrap break-words'>
                        {message.content}
                      </p>
                      <p
                        className={`text-xs ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                      >
                        {formatTimestampToDate(message.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
        <div className='border-t px-5 py-3'>
          <div className='flex items-end gap-2'>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t('Type your message')}
              className='min-h-11 flex-1 resize-none'
              rows={2}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend()
                }
              }}
            />
            <Button
              type='button'
              size='icon'
              onClick={() => void handleSend()}
              disabled={isSending || !content.trim()}
              aria-label={t('Send')}
            >
              {isSending ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Send className='size-4' />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

