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
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight, House } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ConfigDrawer } from '@/shared/components/config-drawer'
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { NotificationPopover } from '@/shared/components/notification-popover'
import { ProfileDropdown } from '@/shared/components/profile-dropdown'
import { Search } from '@/shared/components/search'
import { Button } from '@/shared/components/ui/button'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
import { useNotifications } from '@/shared/hooks/use-notifications'

import { useAdminSidebarData } from '@/apps/admin/layout/admin-nav-data'
import type { NavGroup } from '../types'

type Crumb = { group: string; item: string }
type NavEntry = NavGroup['items'][number]

/**
 * Resolves the current section path for the header.
 *
 * The deepest matching navigation URL wins, so `/admin/system-settings/billing`
 * reports "Billing & Payment" rather than its parent group label alone.
 */
function resolveCrumb(groups: NavGroup[], pathname: string): Crumb | null {
  const matches: Array<Crumb & { length: number }> = []

  const visit = (group: NavGroup, item: NavEntry, parent?: string) => {
    const url = typeof item.url === 'string' ? item.url : ''
    if (url && pathname.startsWith(url)) {
      matches.push({
        group: group.title,
        item: parent ? `${parent} · ${item.title}` : item.title,
        length: url.length,
      })
    }
    if ('items' in item && item.items) {
      for (const child of item.items) {
        visit(group, child, item.title)
      }
    }
  }

  for (const group of groups) {
    for (const item of group.items) {
      visit(group, item)
    }
  }

  matches.sort((a, b) => a.length - b.length)
  const best = matches.at(-1)
  return best ? { group: best.group, item: best.item } : null
}

/**
 * Admin console header.
 *
 * Deliberately different from the public-facing app header: no marketing
 * navigation, one row, a section breadcrumb on the start edge and only the
 * compact console utilities on the end edge.
 */
export function AdminHeader() {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const { navGroups } = useAdminSidebarData()
  const crumb = resolveCrumb(navGroups, pathname)
  const notifications = useNotifications()

  return (
    <header className='bg-console-surface border-console-line sticky top-0 z-40 h-[var(--app-header-height,3rem)] w-full shrink-0 border-b'>
      <div className='flex h-full items-center gap-1.5 px-2 sm:gap-2 sm:px-3'>
        <SidebarTrigger variant='ghost' className='text-console-ink-2' />

        <nav
          aria-label={t('Breadcrumb')}
          className='flex min-w-0 flex-1 items-center gap-1.5 text-xs'
        >
          <Link
            to='/admin/overview'
            className='text-console-ink-3 hover:text-console-ink hidden shrink-0 transition-colors sm:inline'
          >
            {t('Console')}
          </Link>
          {crumb ? (
            <>
              <ChevronRight
                aria-hidden='true'
                className='text-console-ink-3 hidden size-3 shrink-0 rtl:rotate-180 sm:inline'
              />
              <span className='text-console-ink-3 hidden shrink-0 truncate sm:inline'>
                {crumb.group}
              </span>
              <ChevronRight
                aria-hidden='true'
                className='text-console-ink-3 size-3 shrink-0 rtl:rotate-180'
              />
            </>
          ) : null}
          <span className='text-console-ink truncate font-medium'>
            {crumb?.item ?? t('Console')}
          </span>
        </nav>

        <div className='flex shrink-0 items-center gap-0.5 sm:gap-1'>
          <Search className='w-8 flex-none [&>span]:hidden' />
          <NotificationPopover
            open={notifications.popoverOpen}
            onOpenChange={notifications.setPopoverOpen}
            unreadCount={notifications.unreadCount}
            activeTab={notifications.activeTab}
            onTabChange={notifications.setActiveTab}
            notice={notifications.notice}
            announcements={notifications.announcements}
            loading={notifications.loading}
            inboxEnabled={notifications.signedIn}
            inbox={notifications.inbox}
            inboxLoading={notifications.inboxLoading}
            onDismissInboxItem={notifications.dismissInboxItem}
            onMarkInboxRead={notifications.markInboxRead}
          />
          <LanguageSwitcher />
          <ConfigDrawer />
          <Button
            variant='ghost'
            size='icon-sm'
            className='text-console-ink-2'
            aria-label={t('View public site')}
            title={t('View public site')}
            render={<Link to='/' />}
          >
            <House className='size-4' />
          </Button>
          <ProfileDropdown portalContext='admin' />
        </div>
      </div>
    </header>
  )
}
