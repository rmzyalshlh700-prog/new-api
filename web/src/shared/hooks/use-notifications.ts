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
import { useState, useMemo, useCallback } from 'react'

import { useStatus } from '@/shared/hooks/use-status'
import { getNotice } from '@/shared/lib/api'
import { requireServerSuccess } from '@/shared/lib/server-error-message'
import {
  dismissMyNotification,
  getMyNotifications,
  markMyNotificationsRead,
} from '@/shared/lib/user-notifications'
import type { UserNotificationPage } from '@/shared/lib/user-notifications'
import { useAuthStore } from '@/shared/stores/auth-store'
import { useNotificationStore } from '@/shared/stores/notification-store'

export type NotificationTab = 'inbox' | 'notice' | 'announcements'

const INBOX_QUERY_KEY = ['user-notifications', 'inbox'] as const

function hashString(input: string): string {
  let hash = 0
  if (!input) return '0'

  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }

  return hash.toString(36)
}

/**
 * Generate a unique key for an announcement
 * Prefer backend id, fall back to a content hash so edits register
 */
function getAnnouncementKey(item: Record<string, unknown>): string {
  if (!item) return ''

  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`
  }

  const fingerprint = JSON.stringify({
    publishDate: (item?.publishDate as string) || '',
    content: ((item?.content as string) || '').trim(),
    extra: ((item?.extra as string) || '').trim(),
    type: (item?.type as string) || '',
    title: ((item?.title as string) || '').trim(),
    link: ((item?.link as string) || '').trim(),
  })
  return `hash:${hashString(fingerprint)}`
}

/**
 * Hook to manage notifications: the signed-in user's personal inbox, the
 * platform Notice and the announcement timeline.
 *
 * The inbox is stored per user on the server, so it survives a new device or a
 * cleared browser and reaches only the account an administrator addressed.
 */
export function useNotifications() {
  const signedIn = useAuthStore((state) => Boolean(state.auth.user))
  const queryClient = useQueryClient()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NotificationTab>(() =>
    signedIn ? 'inbox' : 'notice'
  )

  // Fetch Notice from API
  const {
    data: noticeResponse,
    isLoading: noticeLoading,
    refetch: refetchNotice,
  } = useQuery({
    queryKey: ['notice'],
    queryFn: async () => requireServerSuccess(await getNotice()),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Fetch Announcements from status
  const { status, loading: statusLoading } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  const announcements = useMemo<Record<string, unknown>[]>(() => {
    if (!announcementsEnabled) return []
    return ((status?.announcements || []) as Record<string, unknown>[]).slice(
      0,
      20
    )
  }, [announcementsEnabled, status?.announcements])

  // The signed-in user's own inbox. Polls while the bell is closed so a
  // notification an administrator just sent shows up without a reload.
  const inboxQuery = useQuery({
    queryKey: INBOX_QUERY_KEY,
    queryFn: async () => getMyNotifications({ page_size: 20 }),
    enabled: signedIn,
    staleTime: 1000 * 30,
    refetchInterval: signedIn && !popoverOpen ? 1000 * 60 : false,
  })
  const inbox = inboxQuery.data?.items ?? []
  const inboxUnread = inboxQuery.data?.unread ?? 0

  const markInboxReadMutation = useMutation({
    mutationFn: (payload: { ids?: number[]; all?: boolean }) =>
      markMyNotificationsRead(payload),
    onSuccess: (data) => {
      queryClient.setQueryData<UserNotificationPage>(INBOX_QUERY_KEY, (prev) =>
        prev
          ? {
              ...prev,
              unread: data.unread,
              items: prev.items.map((item) => ({
                ...item,
                read_at: item.read_at || Math.floor(Date.now() / 1000),
              })),
            }
          : prev
      )
    },
  })

  const dismissInboxMutation = useMutation({
    mutationFn: (id: number) => dismissMyNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY })
    },
  })

  // Notification store
  const {
    lastReadNotice,
    markNoticeRead,
    markAnnouncementsRead,
    isAnnouncementRead,
  } = useNotificationStore()

  // Extract notice content
  const noticeContent = noticeResponse?.success
    ? (noticeResponse.data || '').trim()
    : ''

  // Calculate unread counts
  const unreadCounts = useMemo(() => {
    const noticeUnread =
      noticeContent && noticeContent !== lastReadNotice ? 1 : 0

    const announcementsUnread = announcements.filter(
      (item: Record<string, unknown>) => {
        const key = getAnnouncementKey(item)
        return !isAnnouncementRead(key)
      }
    ).length

    return {
      inbox: inboxUnread,
      notice: noticeUnread,
      announcements: announcementsUnread,
      total: noticeUnread + announcementsUnread + inboxUnread,
    }
  }, [noticeContent, lastReadNotice, announcements, isAnnouncementRead, inboxUnread])

  const markAnnouncementsAsRead = useCallback(() => {
    if (announcements.length > 0) {
      const allKeys = announcements.map((item: Record<string, unknown>) =>
        getAnnouncementKey(item)
      )
      markAnnouncementsRead(allKeys)
    }
  }, [announcements, markAnnouncementsRead])

  const markInboxAsRead = useCallback(() => {
    if (inboxUnread > 0) {
      markInboxReadMutation.mutate({ all: true })
    }
  }, [inboxUnread, markInboxReadMutation])

  // Handle popover open
  const handleOpenPopover = useCallback(
    (tab?: NotificationTab) => {
      const nextTab = tab || activeTab

      // Mark currently visible content as read when opening the notification
      // center. The inbox keeps its unread highlight while it is open and is
      // marked once the person closes it, so nothing disappears mid-read.
      if (noticeContent) {
        markNoticeRead(noticeContent)
      }
      if (nextTab === 'announcements') {
        markAnnouncementsAsRead()
      }
      if (nextTab === 'inbox' && signedIn) {
        void inboxQuery.refetch()
      }

      setActiveTab(nextTab)
      setPopoverOpen(true)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeTab,
      noticeContent,
      markNoticeRead,
      markAnnouncementsAsRead,
      signedIn,
      inboxQuery.refetch,
    ]
  )

  const handlePopoverOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        handleOpenPopover(activeTab)
        return
      }

      // Closing the bell is what acknowledges the personal inbox.
      if (activeTab === 'inbox') {
        markInboxAsRead()
      }
      setPopoverOpen(false)
    },
    [activeTab, handleOpenPopover, markInboxAsRead]
  )

  // Handle tab change - mark announcements as read when switching to that tab
  const handleTabChange = useCallback(
    (tab: NotificationTab) => {
      if (activeTab === 'inbox' && tab !== 'inbox') {
        markInboxAsRead()
      }
      setActiveTab(tab)

      if (tab === 'announcements') {
        markAnnouncementsAsRead()
      }
    },
    [activeTab, markAnnouncementsAsRead, markInboxAsRead]
  )

  return {
    // Data
    signedIn,
    notice: noticeContent,
    announcements,
    inbox,
    loading: noticeLoading || statusLoading,
    inboxLoading: inboxQuery.isLoading,
    inboxTotal: inboxQuery.data?.total ?? 0,

    // Unread counts
    unreadCount: unreadCounts.total,
    unreadNoticeCount: unreadCounts.notice,
    unreadAnnouncementsCount: unreadCounts.announcements,
    unreadInboxCount: unreadCounts.inbox,

    // Popover state
    popoverOpen,
    setPopoverOpen: handlePopoverOpenChange,
    activeTab,
    setActiveTab: handleTabChange,

    // Actions
    openPopover: handleOpenPopover,
    closePopover: () => setPopoverOpen(false),
    refetchNotice,
    refetchInbox: inboxQuery.refetch,
    markInboxRead: markInboxAsRead,
    dismissInboxItem: (id: number) => dismissInboxMutation.mutate(id),
  }
}

export type UseNotificationsResult = ReturnType<typeof useNotifications>
