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
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConsoleSectionCard } from '@/shared/components/console'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'
import { handleServerError } from '@/shared/lib/handle-server-error'

import { resolveNotificationTarget, sendUserNotification } from '../api'
import type { NotificationLevel } from '../api'

export const NOTIFICATION_LEVELS: NotificationLevel[] = [
  'info',
  'success',
  'warning',
  'error',
]

const LEVEL_LABEL_KEYS: Record<NotificationLevel, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Urgent',
}

const MAX_TITLE_LENGTH = 120
const MAX_CONTENT_LENGTH = 4000

export function NotificationComposer() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [account, setAccount] = useState('')
  const [debouncedAccount, setDebouncedAccount] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [level, setLevel] = useState<NotificationLevel>('info')
  const [link, setLink] = useState('')
  const [deliverExternal, setDeliverExternal] = useState(false)

  // Debounce the account lookup so typing an email does not fire a request on
  // every keystroke.
  useEffect(() => {
    const trimmed = account.trim()
    const timer = setTimeout(() => setDebouncedAccount(trimmed), 350)
    return () => clearTimeout(timer)
  }, [account])

  const targetQuery = useQuery({
    queryKey: ['notification-target', debouncedAccount],
    queryFn: ({ signal }) =>
      resolveNotificationTarget(debouncedAccount, signal),
    enabled: debouncedAccount.length > 0,
    retry: false,
    staleTime: 1000 * 30,
  })

  const resolvedTarget = targetQuery.data

  const levelItems = useMemo(
    () =>
      NOTIFICATION_LEVELS.map((value) => ({
        value,
        label: t(LEVEL_LABEL_KEYS[value]),
      })),
    [t]
  )

  const sendMutation = useMutation({
    mutationFn: sendUserNotification,
    onSuccess: (result) => {
      toast.success(
        t('Notification sent to {{username}}', {
          username: result.recipient.username,
        })
      )
      if (result.external.attempted && !result.external.delivered) {
        toast.warning(
          t(
            'It reached their inbox, but the external delivery failed: {{reason}}',
            {
              reason: result.external.message || t('unknown error'),
            }
          )
        )
      } else if (result.external.attempted && result.external.delivered) {
        toast.success(
          t('It was also delivered through their notification channel')
        )
      }

      setTitle('')
      setContent('')
      setLink('')
      setLevel('info')
      setDeliverExternal(false)
      void queryClient.invalidateQueries({
        queryKey: ['sent-notifications'],
      })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to send the notification')),
  })

  const canSend =
    Boolean(resolvedTarget) &&
    title.trim().length > 0 &&
    !sendMutation.isPending

  const handleSend = () => {
    if (!resolvedTarget) return
    sendMutation.mutate({
      account: String(resolvedTarget.id),
      title: title.trim(),
      content: content.trim(),
      level,
      link: link.trim(),
      deliver_external: deliverExternal,
    })
  }

  return (
    <ConsoleSectionCard
      title={t('Send a notification')}
      className='min-h-[26rem]'
      footer={
        <Button onClick={handleSend} disabled={!canSend}>
          {sendMutation.isPending ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Send className='size-4' />
          )}
          {t('Send notification')}
        </Button>
      }
    >
      <div className='flex flex-col gap-4'>
        {/* Recipient */}
        <div className='flex flex-col gap-2'>
          <Label htmlFor='notification-account'>{t('Recipient')}</Label>
          <Input
            id='notification-account'
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            placeholder={t('User ID, username or email')}
            autoComplete='off'
          />
          <div className='min-h-9 text-xs'>
            {debouncedAccount.length === 0 ? (
              <span className='text-muted-foreground'>
                {t('Type an account to look it up')}
              </span>
            ) : targetQuery.isFetching ? (
              <span className='text-muted-foreground flex items-center gap-1.5'>
                <Loader2 className='size-3.5 animate-spin' />
                {t('Looking up the account...')}
              </span>
            ) : targetQuery.isError ? (
              <span className='text-destructive flex items-center gap-1.5'>
                <AlertCircle className='size-3.5' />
                {t('No user matches that ID, username or email')}
              </span>
            ) : resolvedTarget ? (
              <div className='bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5'>
                <UserRound className='size-3.5' />
                <span className='font-medium'>
                  {resolvedTarget.display_name || resolvedTarget.username}
                </span>
                <span className='text-muted-foreground'>
                  @{resolvedTarget.username}
                </span>
                {resolvedTarget.email ? (
                  <span className='text-muted-foreground'>
                    {resolvedTarget.email}
                  </span>
                ) : null}
                <Badge variant='outline'>#{resolvedTarget.id}</Badge>
                {resolvedTarget.status === 2 ? (
                  <Badge variant='destructive'>{t('Disabled')}</Badge>
                ) : (
                  <Badge variant='secondary' className='gap-1'>
                    <CheckCircle2 className='size-3' />
                    {t('Enabled')}
                  </Badge>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Title */}
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='notification-title'>{t('Title')}</Label>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {title.length}/{MAX_TITLE_LENGTH}
            </span>
          </div>
          <Input
            id='notification-title'
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('For example: your plan renews tomorrow')}
          />
        </div>

        {/* Content */}
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='notification-content'>{t('Message')}</Label>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
          </div>
          <Textarea
            id='notification-content'
            value={content}
            rows={5}
            maxLength={MAX_CONTENT_LENGTH}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t('What should they know?')}
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          {/* Level */}
          <div className='flex flex-col gap-2'>
            <Label htmlFor='notification-level'>{t('Type')}</Label>
            <Select
              items={levelItems}
              value={level}
              onValueChange={(next) =>
                setLevel((next as NotificationLevel) ?? 'info')
              }
            >
              <SelectTrigger id='notification-level' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {levelItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Link */}
          <div className='flex flex-col gap-2'>
            <Label htmlFor='notification-link'>{t('Link')}</Label>
            <Input
              id='notification-link'
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder={t('Optional: /wallet or https://...')}
            />
          </div>
        </div>

        {/* External delivery */}
        <div className='flex items-start justify-between gap-4 rounded-lg border p-3'>
          <div className='flex flex-col gap-1'>
            <Label htmlFor='notification-external'>
              {t('Also deliver through their notification channel')}
            </Label>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Uses whatever the user configured in their own notification settings: email, webhook, Bark or Gotify.'
              )}
            </p>
          </div>
          <Switch
            id='notification-external'
            checked={deliverExternal}
            onCheckedChange={setDeliverExternal}
          />
        </div>
      </div>
    </ConsoleSectionCard>
  )
}
