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
import { api } from '@/shared/lib/api'

import type { ContactLink, ContactLinkPosition } from '@/shared/components/contact/contact-links-data'

export interface AddContactLinkPayload {
  title: string
  url: string
  icon: string
  position: ContactLinkPosition
  is_active: boolean
}

export interface UpdateContactLinkPayload {
  id: string
  title?: string
  url?: string
  icon?: string
  position?: ContactLinkPosition
  is_active?: boolean
}

async function unwrap<T>(
  res: { data: { success: boolean; message?: string; data?: T } },
  fallback: string
): Promise<T> {
  if (!res.data.success) {
    throw new Error(res.data.message || fallback)
  }
  return res.data.data as T
}

/** List every contact link, including inactive ones. Admin-only. */
export async function getAdminContactLinks() {
  const res = await api.get<{
    success: boolean
    message?: string
    data?: ContactLink[]
  }>('/api/admin/contact_links')
  return unwrap<ContactLink[]>(res, 'Failed to load contact links')
}

/** Create a contact link. Admin-only. */
export async function addAdminContactLink(payload: AddContactLinkPayload) {
  const res = await api.post<{
    success: boolean
    message?: string
    data?: ContactLink
  }>('/api/admin/contact_links', payload)
  return unwrap<ContactLink>(res, 'Failed to add contact link')
}

/** Partially update a contact link by id. Admin-only. */
export async function updateAdminContactLink(payload: UpdateContactLinkPayload) {
  const res = await api.put<{
    success: boolean
    message?: string
    data?: ContactLink[]
  }>('/api/admin/contact_links', payload)
  return unwrap<ContactLink[]>(res, 'Failed to update contact link')
}

/** Delete a contact link by id. Admin-only. */
export async function deleteAdminContactLink(id: string) {
  const res = await api.delete<{
    success: boolean
    message?: string
    data?: ContactLink[]
  }>(`/api/admin/contact_links/${id}`)
  return unwrap<ContactLink[]>(res, 'Failed to delete contact link')
}
