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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/shared/lib/api'
import { useAuthStore } from '@/shared/stores/auth-store'

import type { User } from '../../types'
import { UsersMutateDrawer } from '../users-mutate-drawer'
import { UsersProvider } from '../users-provider'

const target: User = {
  id: 2,
  username: 'managed-user',
  display_name: 'Managed user',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
}

function renderDrawer(currentRow?: User) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/authz/catalog') {
      return { data: { success: true, data: { resources: [], roles: [] } } }
    }
    if (url === '/api/group/') {
      return { data: { success: true, data: ['default'] } }
    }
    return { data: { success: true, data: target } }
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <UsersProvider>
        <UsersMutateDrawer
          open
          onOpenChange={() => undefined}
          currentRow={currentRow}
        />
      </UsersProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

it('editing a user does not render a strength meter or requirement text', async () => {
  const user = userEvent.setup()
  renderDrawer(target)
  const password = await screen.findByLabelText('Password')
  expect(
    screen.queryByRole('meter', { name: 'Password strength' })
  ).not.toBeInTheDocument()
  expect(password.getAttribute('aria-describedby')).not.toContain(
    'user-password-strength'
  )

  await user.type(password, 'new password')

  expect(
    screen.queryByRole('meter', { name: 'Password strength' })
  ).not.toBeInTheDocument()
})

it('creating a user accepts any non-empty password with a plain placeholder', async () => {
  renderDrawer()
  const password = await screen.findByLabelText('Password')

  expect(password).toHaveAttribute('placeholder', 'Enter password')

  await userEvent.setup().type(password, '123')
  expect(password).toHaveValue('123')
})
