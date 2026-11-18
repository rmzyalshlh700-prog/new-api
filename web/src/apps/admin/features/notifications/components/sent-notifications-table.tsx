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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Eye, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { handleServerError } from '@/shared/lib/handle-server-error'
import { formatDate } from '@/shared/lib/time'

import { getSentNotifications, revokeNotification } from '../api'
import type { NotificationLevel, SentNotification } from '../api'

const PAGE_SIZE = 20

const LEVEL_BADGE_VARIANT: Record<
  NotificationLevel,
  'default' | 'secondary' | 'warning' | 'destructive'
> = {
  info: 'secondary',
  success: 'default',
  warning: 'warning',
  error: 'destructive',
}

const LEVEL_LABEL_KEYS: Record<NotificationLevel, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Urgent',
}

export function SentNotificationsTable() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pendingRevoke, setPendingRevoke] = useState<SentNotification | null>(
    null
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [keyword])

  const sentQuery = useQuery({
    queryKey: ['sent-notifications', debouncedKeyword, page],
    queryFn: () =>
      getSentNotifications({
        keyword: debouncedKeyword,
        page,
        page_size: PAGE_SIZE,
      }),
    staleTime: 1000 * 15,
  })

  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeNotification(id),
    onSuccess: () => {
      toast.success(t('Notification recalled'))
      setPendingRevoke(null)
      void queryClient.invalidateQueries({ queryKey: ['sent-notifications'] })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to recall the notification')),
  })

  const items = sentQuery.data?.items ?? []
  const total = sentQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const rangeLabel = useMemo(() => {
    if (total === 0) return t('No notifications sent yet')
    const from = (page - 1) * PAGE_SIZE + 1
    const to = Math.min(page * PAGE_SIZE, total)
    return t('Showing {{from}}-{{to}} of {{total}}', { from, to, total })
  }, [page, total, t])

  return (
    <Card>
      <CardHeader className='gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-col gap-1'>
          <CardTitle>{t('Sent notifications')}</CardTitle>
          <CardDescription>
            {t('What each recipient received, and whether they read it')}
          </CardDescription>
        </div>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('Search by recipient or text')}
          className='sm:w-64'
        />
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        <div className='overflow-x-auto rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Recipient')}</TableHead>
                <TableHead>{t('Notification')}</TableHead>
                <TableHead className='w-36'>{t('Sent')}</TableHead>
                <TableHead className='w-24'>{t('Status')}</TableHead>
                <TableHead className='w-16' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sentQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-24 text-center'>
                    <Loader2 className='mx-auto size-4 animate-spin' />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground h-24 text-center text-sm'
                  >
                    {t('No notifications sent yet')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className='flex flex-col'>
                        <span className='font-medium'>
                          {item.display_name || item.username ||
                            `#${item.user_id}`}
                        </span>
                        <span className='text-muted-foreground text-xs'>
                          {item.username ? `@${item.username}` : null}
                          {item.email ? ` · ${item.email}` : null}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex max-w-md flex-col gap-1'>
                        <div className='flex items-center gap-2'>
                          <Badge
                            variant={
                              LEVEL_BADGE_VARIANT[item.level] ?? 'secondary'
                            }
                          >
                            {t(LEVEL_LABEL_KEYS[item.level] ?? 'Information')}
                          </Badge>
                          <span className='truncate text-sm font-medium'>
                            {item.title}
                          </span>
                        </div>
                        {item.content ? (
                          <span className='text-muted-foreground line-clamp-2 text-xs'>
                            {item.content}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className='text-muted-foreground text-xs'>
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell>
                      {item.read ? (
                        <Badge variant='outline' className='gap-1'>
                          <Eye className='size-3' />
                          {t('Read')}
                        </Badge>
                      ) : (
                        <Badge variant='secondary' className='gap-1'>
                          <CheckCheck className='size-3' />
                          {t('Unread')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label={t('Recall')}
                        onClick={() => setPendingRevoke(item)}
                      >
                        <Trash2 className='text-destructive size-3.5' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className='flex items-center justify-between gap-2'>
          <span className='text-muted-foreground text-xs'>{rangeLabel}</span>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title={t('Recall this notification?')}
        desc={t(
          'It disappears from the recipient\'s inbox. This cannot be undone.'
        )}
        confirmText={t('Recall')}
        destructive
        isLoading={revokeMutation.isPending}
        handleConfirm={() =>
          pendingRevoke && revokeMutation.mutate(pendingRevoke.id)
        }
      />
    </Card>
  )
}
