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
import type { TFunction } from 'i18next'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Info,
  Megaphone,
  X,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { RichContent } from '@/shared/components/rich-content'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Separator } from '@/shared/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { getAnnouncementColorClass } from '@/shared/lib/colors'
import { formatDateTimeObject } from '@/shared/lib/time'
import type { UserNotification } from '@/shared/lib/user-notifications'
import { cn } from '@/shared/lib/utils'

import type { NotificationTab } from '../hooks/use-notifications'

interface AnnouncementItem {
  id?: number | string
  type?: string
  content?: string
  extra?: string
  publishDate?: string | Date
}

interface NotificationPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unreadCount: number
  activeTab: NotificationTab
  onTabChange: (tab: NotificationTab) => void
  notice: string
  announcements: AnnouncementItem[]
  loading: boolean
  className?: string
  /** Personal notifications the signed-in user received. Hidden when signed out. */
  inboxEnabled?: boolean
  inbox?: UserNotification[]
  inboxLoading?: boolean
  onDismissInboxItem?: (id: number) => void
  onMarkInboxRead?: () => void
}

const INBOX_LEVEL_STYLES = {
  info: { icon: Info, tone: 'text-sky-600 dark:text-sky-400' },
  success: { icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
  warning: {
    icon: AlertTriangle,
    tone: 'text-amber-600 dark:text-amber-400',
  },
  error: { icon: XCircle, tone: 'text-rose-600 dark:text-rose-400' },
} as const

function getInboxLevelStyle(level: string) {
  return (
    INBOX_LEVEL_STYLES[level as keyof typeof INBOX_LEVEL_STYLES] ??
    INBOX_LEVEL_STYLES.info
  )
}

/**
 * Get relative time string from a date
 */
function getRelativeTime(publishDate: string | Date, t: TFunction): string {
  if (!publishDate) return ''

  const now = new Date()
  const pubDate = new Date(publishDate)

  // If invalid date, return original string
  if (Number.isNaN(pubDate.getTime())) {
    return typeof publishDate === 'string' ? publishDate : ''
  }

  const diffMs = now.getTime() - pubDate.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // If future time, show specific date
  if (diffMs < 0) return formatDateTimeObject(pubDate)

  // Return relative time based on difference
  if (diffSeconds < 60) return t('Just now')
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? t('1 minute ago')
      : t('{{count}} minutes ago', { count: diffMinutes })
  }
  if (diffHours < 24) {
    return diffHours === 1
      ? t('1 hour ago')
      : t('{{count}} hours ago', { count: diffHours })
  }
  if (diffDays < 7) {
    return diffDays === 1
      ? t('1 day ago')
      : t('{{count}} days ago', { count: diffDays })
  }
  if (diffWeeks < 4) {
    return diffWeeks === 1
      ? t('1 week ago')
      : t('{{count}} weeks ago', { count: diffWeeks })
  }
  if (diffMonths < 12) {
    return diffMonths === 1
      ? t('1 month ago')
      : t('{{count}} months ago', { count: diffMonths })
  }
  if (diffYears < 2) return t('1 year ago')

  // Over 2 years, show specific date
  return formatDateTimeObject(pubDate)
}

/**
 * Announcement status dot indicator
 */
function AnnouncementDot({ type }: { type?: string }) {
  return (
    <span
      className={cn(
        'mt-1.5 inline-block size-2 shrink-0 rounded-full',
        getAnnouncementColorClass(type)
      )}
    />
  )
}

function getAnnouncementRenderKey(announcement: AnnouncementItem): string {
  if (announcement.id !== undefined && announcement.id !== null) {
    return `id:${announcement.id}`
  }

  return JSON.stringify({
    content: announcement.content ?? '',
    extra: announcement.extra ?? '',
    publishDate: announcement.publishDate ?? '',
    type: announcement.type ?? '',
  })
}

/**
 * Empty state component
 */
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <Empty className='min-h-48 border-0 p-4'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}

/**
 * Personal inbox: notifications an administrator addressed to this account.
 */
function InboxContent({
  inbox,
  loading,
  t,
  onDismiss,
}: {
  inbox: UserNotification[]
  loading: boolean
  t: TFunction
  onDismiss?: (id: number) => void
}) {
  if (loading) {
    return (
      <EmptyState
        icon={<Bell />}
        title={t('Loading...')}
        description={t('Notifications sent to your account')}
      />
    )
  }

  if (inbox.length === 0) {
    return (
      <EmptyState
        icon={<Bell />}
        title={t('No notifications yet')}
        description={t('Notifications sent to your account appear here')}
      />
    )
  }

  return (
    <ScrollArea className='h-[min(52vh,28rem)] pe-3'>
      <div className='flex flex-col gap-1'>
        {inbox.map((item) => {
          const style = getInboxLevelStyle(item.level)
          const LevelIcon = style.icon
          const createdAt = new Date(item.created_at * 1000)
          const relativeTime = Number.isNaN(createdAt.getTime())
            ? ''
            : getRelativeTime(createdAt, t)
          const unread = !item.read_at
          const hasLink =
            item.link.startsWith('/') || /^https?:\/\//i.test(item.link)

          return (
            <div
              key={item.id}
              className={cn(
                'group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors',
                unread ? 'bg-accent/40' : 'hover:bg-accent/30'
              )}
            >
              <LevelIcon
                className={cn('mt-0.5 size-4 shrink-0', style.tone)}
                aria-hidden='true'
              />
              <div className='flex min-w-0 flex-1 flex-col gap-1'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='text-sm font-medium break-words'>
                    {item.title}
                  </p>
                  {unread ? (
                    <span
                      className='bg-primary mt-1.5 inline-block size-1.5 shrink-0 rounded-full'
                      aria-label={t('Unread')}
                    />
                  ) : null}
                </div>

                {item.content ? (
                  <p className='text-muted-foreground line-clamp-4 text-xs whitespace-pre-wrap break-words'>
                    {item.content}
                  </p>
                ) : null}

                <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]'>
                  {relativeTime ? (
                    <span title={formatDateTimeObject(createdAt)}>
                      {relativeTime}
                    </span>
                  ) : null}
                  {hasLink ? (
                    <a
                      href={item.link}
                      target={item.link.startsWith('/') ? undefined : '_blank'}
                      rel='noopener noreferrer'
                      className='text-primary font-medium hover:underline'
                    >
                      {t('Open')}
                    </a>
                  ) : null}
                </div>
              </div>

              {onDismiss ? (
                <Button
                  variant='ghost'
                  size='icon-sm'
                  className='opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'
                  onClick={() => onDismiss(item.id)}
                  aria-label={t('Dismiss')}
                >
                  <X className='size-3.5' />
                </Button>
              ) : null}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

/**
 * Notice tab content
 */
function NoticeContent({
  notice,
  loading,
  t,
}: {
  notice: string
  loading: boolean
  t: TFunction
}) {
  if (loading) {
    return (
      <EmptyState
        icon={<Bell />}
        title={t('Loading...')}
        description={t('Latest platform updates and notices')}
      />
    )
  }

  if (!notice) {
    return (
      <EmptyState icon={<Bell />} title={t('No announcements at this time')} />
    )
  }

  return (
    <ScrollArea className='h-[min(52vh,28rem)] pe-3'>
      <RichContent breaks content={notice} />
    </ScrollArea>
  )
}

/**
 * Announcements tab content
 */
function AnnouncementsContent({
  announcements,
  loading,
  t,
}: {
  announcements: AnnouncementItem[]
  loading: boolean
  t: TFunction
}) {
  if (loading) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title={t('Loading...')}
        description={t('Latest platform updates and notices')}
      />
    )
  }

  if (announcements.length === 0) {
    return (
      <EmptyState icon={<Megaphone />} title={t('No system announcements')} />
    )
  }

  return (
    <ScrollArea className='h-[min(52vh,28rem)] pe-3'>
      <div className='flex flex-col'>
        {announcements.map((item, idx) => {
          const announcementKey = getAnnouncementRenderKey(item)
          const publishDate = item.publishDate
            ? new Date(item.publishDate)
            : null
          const relativeTime = publishDate
            ? getRelativeTime(publishDate, t)
            : ''
          const absoluteTime = publishDate
            ? formatDateTimeObject(publishDate)
            : ''

          return (
            <div key={announcementKey}>
              <div className='py-3'>
                <div className='flex items-start gap-3'>
                  <AnnouncementDot type={item.type} />
                  <div className='flex min-w-0 flex-1 flex-col gap-2'>
                    <div className='text-sm'>
                      <RichContent breaks content={item.content || ''} />
                    </div>

                    {item.extra ? (
                      <div className='text-muted-foreground text-xs'>
                        <RichContent breaks content={item.extra} />
                      </div>
                    ) : null}

                    {absoluteTime ? (
                      <div className='text-muted-foreground text-xs'>
                        {relativeTime ? `${relativeTime} • ` : null}
                        {absoluteTime}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {idx < announcements.length - 1 ? <Separator /> : null}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

/**
 * Notification popover with the personal inbox, the Notice and the
 * announcement timeline.
 */
export function NotificationPopover({
  open,
  onOpenChange,
  unreadCount,
  activeTab,
  onTabChange,
  notice,
  announcements,
  loading,
  className,
  inboxEnabled = false,
  inbox = [],
  inboxLoading = false,
  onDismissInboxItem,
  onMarkInboxRead,
}: NotificationPopoverProps) {
  const { t } = useTranslation()
  const showInbox = inboxEnabled
  const inboxUnread = inbox.filter((item) => !item.read_at).length

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            className={cn('relative size-9', className)}
            aria-label={t('Notifications')}
          />
        }
      >
        <Bell className='size-[1.2rem]' />
        {unreadCount > 0 ? (
          <Badge
            variant='destructive'
            className='absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-semibold tabular-nums'
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align='end'
        sideOffset={8}
        className='w-[min(26rem,calc(100vw-1rem))] gap-3 p-3'
      >
        <PopoverHeader className='gap-1 px-1'>
          <PopoverTitle>{t('Notifications')}</PopoverTitle>
          <p className='text-muted-foreground text-xs'>
            {t('Messages sent to you and platform announcements')}
          </p>
        </PopoverHeader>

        <Tabs
          value={activeTab}
          onValueChange={onTabChange as (value: string) => void}
        >
          <TabsList
            className={cn(
              'grid w-full',
              showInbox ? 'grid-cols-3' : 'grid-cols-2'
            )}
          >
            {showInbox ? (
              <TabsTrigger value='inbox' className='gap-1.5'>
                <Bell className='size-3.5' />
                {t('Inbox')}
                {inboxUnread > 0 ? (
                  <span className='bg-destructive text-destructive-foreground rounded-full px-1.5 text-[10px] font-semibold tabular-nums'>
                    {inboxUnread > 99 ? '99+' : inboxUnread}
                  </span>
                ) : null}
              </TabsTrigger>
            ) : null}
            <TabsTrigger value='notice' className='gap-1.5'>
              <Bell className='size-3.5' />
              {t('Notice')}
            </TabsTrigger>
            <TabsTrigger value='announcements' className='gap-1.5'>
              <Megaphone className='size-3.5' />
              {t('Timeline')}
            </TabsTrigger>
          </TabsList>

          {showInbox ? (
            <TabsContent value='inbox' className='mt-2'>
              <InboxContent
                inbox={inbox}
                loading={inboxLoading}
                t={t}
                onDismiss={onDismissInboxItem}
              />
            </TabsContent>
          ) : null}

          <TabsContent value='notice' className='mt-2'>
            <NoticeContent notice={notice} loading={loading} t={t} />
          </TabsContent>

          <TabsContent value='announcements' className='mt-2'>
            <AnnouncementsContent
              announcements={announcements}
              loading={loading}
              t={t}
            />
          </TabsContent>
        </Tabs>

        <div className='flex items-center justify-between gap-2'>
          {showInbox && activeTab === 'inbox' && inboxUnread > 0 && onMarkInboxRead ? (
            <Button
              variant='ghost'
              size='sm'
              className='gap-1.5'
              onClick={onMarkInboxRead}
            >
              <CheckCheck className='size-3.5' />
              {t('Mark all as read')}
            </Button>
          ) : (
            <span />
          )}
          <Button size='sm' onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
