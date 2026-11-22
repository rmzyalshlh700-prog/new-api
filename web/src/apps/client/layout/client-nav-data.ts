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
import {
  BookOpen,
  FileText,
  FlaskConical,
  Key,
  LayoutDashboard,
  LifeBuoy,
  ListTodo,
  MessageSquare,
  Newspaper,
  Plug,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type {
  NavGroup,
  NavItem,
  SidebarData,
} from '@/shared/components/layout/types'
import { usePublicPageVisibility } from '@/shared/features/public-content/visibility'

/**
 * Navigation for the client portal, ordered as:
 * Dashboard → API Keys → Usage Logs → Wallet → Profile →
 * Security & Access → Playground → Chat.
 *
 * Deliberately contains no administrative entries: the admin console is a
 * separate portal with its own layout, routes and bundle.
 */
export function useClientSidebarData(): SidebarData {
  const { t } = useTranslation()
  const visibility = usePublicPageVisibility()

  // Public pages an administrator switched off disappear from this group too.
  const exploreItems: NavItem[] = []
  if (visibility.docs) {
    exploreItems.push({
      title: t('Documentation'),
      url: '/docs',
      icon: BookOpen,
    })
  }
  if (visibility.integrations) {
    exploreItems.push({
      title: t('Integrations'),
      url: '/integrations',
      icon: Plug,
    })
  }
  if (visibility.blog) {
    exploreItems.push({ title: t('Blog'), url: '/blog', icon: Newspaper })
  }

  const exploreGroup: NavGroup[] =
    exploreItems.length > 0
      ? [
          {
            id: 'explore',
            title: t('Explore'),
            items: exploreItems,
          },
        ]
      : []

  return {
    navGroups: [
      {
        id: 'console',
        title: t('Console'),
        items: [
          {
            title: t('Dashboard'),
            url: '/app/workspace/overview',
            icon: LayoutDashboard,
          },
          {
            title: t('API Keys'),
            url: '/app/keys',
            icon: Key,
          },
          {
            title: t('Usage Logs'),
            url: '/app/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Logs'),
            url: '/app/usage-logs/task',
            icon: ListTodo,
          },
          {
            title: t('Drawing Logs'),
            url: '/app/usage-logs/drawing',
            icon: FileText,
          },
        ],
      },
      {
        id: 'account',
        title: t('Account'),
        items: [
          {
            title: t('Wallet'),
            url: '/app/wallet',
            icon: Wallet,
          },
          {
            title: t('Profile'),
            url: '/app/profile',
            icon: User,
          },
          {
            title: t('Security & Access'),
            url: '/app/security',
            icon: ShieldCheck,
          },
          {
            title: t('Support'),
            url: '/app/support',
            icon: LifeBuoy,
          },
        ],
      },
      {
        id: 'ai-studio',
        title: t('Chat'),
        items: [
          {
            title: t('Chat'),
            url: '/app/playground',
            icon: FlaskConical,
          },
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      ...exploreGroup,
    ],
  }
}
