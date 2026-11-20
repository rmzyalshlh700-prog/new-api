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
import { useTranslation } from 'react-i18next'

import { SidebarContactLinks } from '@/shared/components/contact/contact-links'
import { CONTACT_LINK_POSITIONS } from '@/shared/components/contact/contact-links-data'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarResizeHandle,
  SidebarTrigger,
} from '@/shared/components/ui/sidebar'
import { useLayout } from '@/shared/context/layout-provider'
import type { Portal } from '@/shared/lib/portal-url'

import type { NavGroup } from '../types'
import { NavGroup as NavGroupView } from './nav-group'
import { SidebarProfileCard } from './sidebar-profile-card'
import { SystemBrand } from './system-brand'

type AppSidebarProps = {
  /** Navigation owned by the portal that renders this sidebar. */
  navGroups: NavGroup[]
  /** Portal that owns the chrome, so the admin rail keeps its own anchors. */
  portal?: Portal
}

/**
 * Application sidebar.
 *
 * The shell is shared, the navigation is not: each portal passes its own
 * groups, so the client sidebar cannot render an admin entry. The admin rail
 * adds a brand header and a pinned account card; the client portal keeps the
 * plain contact-first rail.
 */
export function AppSidebar(props: AppSidebarProps) {
  const { t } = useTranslation()
  const { collapsible, variant } = useLayout()
  const isAdmin = props.portal === 'admin'

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      {isAdmin ? (
        <SidebarHeader className='border-console-line border-b p-1.5'>
          <div className='flex items-center gap-1'>
            <div className='min-w-0 flex-1'>
              <SystemBrand variant='sidebar' />
            </div>
            <SidebarTrigger className='hidden shrink-0 md:inline-flex' />
          </div>
        </SidebarHeader>
      ) : null}

      {/* Phones keep a deep bottom gutter: the last navigation group scrolls
          clear of the floating assistant launcher and the home indicator. */}
      <SidebarContent className='pt-1.5 pb-24 md:pb-1.5'>
        <SidebarContactLinks position={CONTACT_LINK_POSITIONS.sidebarTop} />
        <div className='flex flex-col'>
          {props.navGroups.map((group) => (
            <NavGroupView key={group.id || group.title} {...group} />
          ))}
        </div>
        <SidebarContactLinks position={CONTACT_LINK_POSITIONS.sidebarBottom} />
      </SidebarContent>

      {isAdmin ? (
        <SidebarFooter className='border-console-line border-t p-0'>
          <SidebarProfileCard />
        </SidebarFooter>
      ) : null}

      <SidebarResizeHandle label={t('Resize sidebar')} />
      <SidebarRail />
    </Sidebar>
  )
}
