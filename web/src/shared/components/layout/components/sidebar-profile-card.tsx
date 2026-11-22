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
import { ChevronsUpDown } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import {
  SidebarMenuButton,
  useSidebar,
} from '@/shared/components/ui/sidebar'
import { useUserDisplay } from '@/shared/hooks/use-user-display'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/shared/lib/avatar'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Pinned account anchor at the bottom of the admin rail. It opens the same
 * profile menu as the header, so the console keeps one identity surface.
 */
export function SidebarProfileCard() {
  const { t } = useTranslation()
  const { state } = useSidebar()
  const user = useAuthStore((store) => store.auth.user)
  const { displayName, roleLabel } = useUserDisplay(user)
  const avatarName = user?.username || displayName
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarFallbackStyle = useMemo(
    () => getUserAvatarStyle(avatarName),
    [avatarName]
  )
  const collapsed = state === 'collapsed'

  return (
    <div className='border-console-line mx-2 mb-2 rounded-lg border'>
      <SidebarMenuButton
        size='lg'
        tooltip={displayName}
        className='h-auto py-2'
        aria-label={t('Account')}
        render={<div />}
      >
        <Avatar className='size-7 shrink-0'>
          <AvatarFallback
            className='text-[11px] font-semibold text-white'
            style={avatarFallbackStyle}
          >
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
        <div className='grid min-w-0 flex-1 text-start text-xs leading-tight'>
          <span className='text-console-ink truncate font-medium'>
            {displayName}
          </span>
          <span className='text-console-ink-3 truncate'>{roleLabel}</span>
        </div>
        {collapsed ? null : (
          <ChevronsUpDown
            aria-hidden='true'
            className='text-console-ink-3 size-3.5 shrink-0'
          />
        )}
      </SidebarMenuButton>
    </div>
  )
}
