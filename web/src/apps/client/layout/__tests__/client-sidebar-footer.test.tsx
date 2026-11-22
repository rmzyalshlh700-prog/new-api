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
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { Key } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppSidebar } from '@/shared/components/layout/components/app-sidebar'
import type { NavGroup } from '@/shared/components/layout/types'
import { SidebarProvider } from '@/shared/components/ui/sidebar'
import { LayoutProvider } from '@/shared/context/layout-provider'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

vi.mock('@/shared/hooks/use-status', () => ({
  useStatus: () => ({
    status: { system_name: 'Astramux', version: 'v0.0.0' },
    loading: false,
  }),
}))

vi.mock('@/shared/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ logo: '/logo.png', loading: false }),
}))

vi.mock('@/shared/components/contact/contact-links', () => ({
  SidebarContactLinks: () => null,
}))

const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    items: [{ title: 'API Keys', url: '/app/keys', icon: Key }],
  },
]

async function renderSidebar(portal: 'client' | 'admin') {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role: portal === 'admin' ? ROLE.ADMIN : ROLE.USER,
    permissions: {},
    sidebar_modules: '',
  })

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <LayoutProvider>
          <SidebarProvider>
            <AppSidebar navGroups={navGroups} portal={portal} />
          </SidebarProvider>
        </LayoutProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/app/keys'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  useAuthStore.getState().auth.reset()
})

describe('client sidebar account footer', () => {
  it('renders no user footer card on the client rail', async () => {
    await renderSidebar('client')

    expect(screen.getByText('API Keys')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="sidebar-footer"]')).toBeNull()
    expect(document.querySelector('[data-slot="avatar"]')).toBeNull()
    expect(screen.queryByLabelText('Account')).toBeNull()
    expect(screen.queryByText('alice')).toBeNull()
  })

  it('keeps the admin rail account card untouched', async () => {
    await renderSidebar('admin')

    expect(
      document.querySelector('[data-slot="sidebar-footer"]')
    ).not.toBeNull()
    expect(screen.getByLabelText('Account')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
  })
})
