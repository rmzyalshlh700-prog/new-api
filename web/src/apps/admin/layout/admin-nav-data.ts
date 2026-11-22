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
  Activity,
  Archive,
  BadgeDollarSign,
  BellRing,
  Box,
  ClipboardList,
  DatabaseBackup,
  Gauge,
  Layers,
  LifeBuoy,
  PlugZap,
  Radio,
  Receipt,
  ScrollText,
  ServerCog,
  Settings,
  Tags,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useModelPricingIssueBadge } from '@/apps/admin/features/model-pricing/pricing-issues'
import { useSupportUnreadBadge } from '@/apps/admin/features/support-tickets/use-support-unread-badge'
import { getSystemSettingsSectionNavItems } from '@/apps/admin/features/system-settings/nav'
import type {
  SidebarBadges,
  SidebarData,
} from '@/shared/components/layout/types'
import { ROLE } from '@/shared/lib/roles'

/**
 * Navigation for the admin portal.
 *
 * Five executive groups, matching the console's information architecture:
 * dashboard, observability, accounts, providers/models, and security/system.
 * Only administative surfaces are listed; end-user features live in the client
 * portal navigation.
 */
export function useAdminSidebarData(): SidebarData {
  const { t } = useTranslation()
  const badges: SidebarBadges = {
    modelPricing: useModelPricingIssueBadge(),
    supportTickets: useSupportUnreadBadge(),
  }
  const settings = getSystemSettingsSectionNavItems(t, badges)

  return {
    navGroups: [
      {
        id: 'dashboard',
        title: t('Dashboard'),
        items: [
          {
            title: t('Overview'),
            url: '/admin/overview',
            icon: Gauge,
          },
        ],
      },
      {
        id: 'observability',
        title: t('Observability'),
        items: [
          {
            title: t('Monitor Center'),
            url: '/admin/monitor',
            icon: Activity,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Request Logs'),
            url: '/app/usage-logs/common',
            icon: ScrollText,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Profits & Margin'),
            url: '/admin/system-settings/billing/model-pricing',
            icon: TrendingUp,
            configUrls: ['/admin/system-settings'],
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
      {
        id: 'access',
        title: t('Access & Accounts'),
        items: [
          {
            title: t('Users'),
            url: '/admin/users',
            icon: Users,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Subscriptions'),
            url: '/admin/subscriptions',
            icon: BadgeDollarSign,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Redemption Codes'),
            url: '/admin/redemption-codes',
            icon: Ticket,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Payment Logs'),
            url: '/admin/payments',
            icon: Receipt,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Notifications'),
            url: '/admin/notifications',
            icon: BellRing,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Support Tickets'),
            url: '/admin/support-tickets',
            icon: LifeBuoy,
            requiredRole: ROLE.ADMIN,
            badge: badges.supportTickets,
          },
        ],
      },
      {
        id: 'providers',
        title: t('Providers & Models'),
        items: [
          {
            title: t('Channels'),
            url: '/admin/channels',
            icon: Radio,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Models'),
            url: '/admin/models/metadata',
            icon: Box,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Upstream Pricing'),
            url: '/admin/system-settings/models/global',
            icon: Tags,
            configUrls: ['/admin/system-settings'],
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('Group Pricing'),
            url: '/admin/system-settings/billing/group-pricing',
            icon: Layers,
            configUrls: ['/admin/system-settings'],
            requiredRole: ROLE.SUPER_ADMIN,
          },
          settings.billing,
          {
            title: t('Task Plugins'),
            url: '/admin/task-plugins',
            icon: PlugZap,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
      {
        id: 'system',
        title: t('Security & System'),
        items: [
          settings.auth,
          settings.security,
          {
            title: t('Audit Logs'),
            url: '/admin/audit-logs',
            icon: ClipboardList,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Archive'),
            url: '/admin/archive',
            icon: Archive,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('System Info'),
            url: '/admin/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('Backup'),
            url: '/admin/backup',
            icon: DatabaseBackup,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/admin/system-settings',
            icon: Settings,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          settings.site,
          settings.content,
          settings.models,
          settings.policies,
          settings.operations,
        ],
      },
    ],
  }
}
