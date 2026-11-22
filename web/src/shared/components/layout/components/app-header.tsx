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
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { NotificationPopover } from '@/shared/components/notification-popover'
import { ThemeSwitch } from '@/shared/components/theme-switch'
import { SystemUpdateAction } from '@/shared/features/system-update/system-update-action'
import { useNotifications } from '@/shared/hooks/use-notifications'
import { useTopNavLinks } from '@/shared/hooks/use-top-nav-links'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { Header } from './header'
import { SystemBrand } from './system-brand'
import { TopNav } from './top-nav'

/**
 * General application Header component
 * Integrates navigation bar, search, configuration and profile functions
 *
 * @example
 * // Basic usage
 * <AppHeader />
 *
 * @example
 * // Custom navigation links
 * <AppHeader navLinks={customLinks} />
 *
 * @example
 * // Hide the navigation bar
 * <AppHeader showTopNav={false} />
 *
 * @example
 * // Fully customize left and right content
 * <AppHeader
 *   leftContent={<CustomLeft />}
 *   rightContent={<CustomRight />}
 * />
 */
type AppHeaderProps = {
  /**
   * Custom navigation links, uses default global navigation or dynamically generated from backend if not provided
   */
  navLinks?: TopNavLink[]
  /**
   * Whether to show top navigation bar
   * @default true
   */
  showTopNav?: boolean
  /**
   * Left content, overrides TopNav if provided
   */
  leftContent?: React.ReactNode
  /**
   * Custom right content, overrides default right content if provided
   */
  rightContent?: React.ReactNode
  /**
   * Whether to show notification button
   * @default true
   */
  showNotifications?: boolean
}

export function AppHeader({
  navLinks = defaultTopNavLinks,
  showTopNav = true,
  leftContent,
  rightContent,
  showNotifications = true,
}: AppHeaderProps) {
  // Prioritize dynamically generated links from backend
  const dynamicLinks = useTopNavLinks()
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  // Notifications hook
  const notifications = useNotifications()

  return (
    <Header>
      {/* Start edge: sidebar toggle (in Header) + logo + Astramux wordmark.
          The group never shrinks, so the wordmark can never be clipped away. */}
      <div className='@container/system-brand flex shrink-0 items-center gap-2'>
        <SystemBrand variant='inline' />
        <div className='hidden sm:flex'>
          <SystemUpdateAction presentation='version' />
        </div>
      </div>

      {leftContent ? (
        <div className='ms-2 flex items-center'>{leftContent}</div>
      ) : null}

      {rightContent ?? (
        <div className='ms-auto flex shrink-0 items-center gap-1 sm:gap-2'>
          {showTopNav && (
            <div className='me-1 hidden lg:block'>
              <TopNav links={links} />
            </div>
          )}
          {showNotifications && (
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
          )}
          <ThemeSwitch />
          <LanguageSwitcher />
        </div>
      )}
    </Header>
  )
}
