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
import { useQuery } from '@tanstack/react-query'

import { useStatus } from '@/shared/hooks/use-status'
import { api } from '@/shared/lib/api'

import {
  normalizeSocialIconSize,
  normalizeSocialLinkPlacement,
  type ContactLink,
  type SocialIconSize,
  type SocialLinkPlacement,
} from './contact-links-data'

/** Fetches the active contact links exposed by the public endpoint. */
export function useContactLinks() {
  return useQuery({
    queryKey: ['contact-links'],
    queryFn: async () => {
      const res = await api.get<{
        success: boolean
        message?: string
        data?: ContactLink[]
      }>('/api/public/contact_links')
      if (!res.data.success) {
        throw new Error(res.data.message || 'Failed to load contact links')
      }
      return res.data.data ?? []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Administrator-chosen presentation of the social links: where the sidebar
 * group renders and how large the icons are. Both values come from
 * `/api/status`, so they are available on first paint without an extra round
 * trip.
 */
export function useContactLinkDisplayPreferences(): {
  placement: SocialLinkPlacement
  iconSize: SocialIconSize
} {
  const { status } = useStatus()
  return {
    placement: normalizeSocialLinkPlacement(status?.contact_links_position),
    iconSize: normalizeSocialIconSize(status?.contact_links_icon_size),
  }
}
