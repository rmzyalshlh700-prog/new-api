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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppHeader } from '@/shared/components/layout/components/app-header'
import { SidebarProvider } from '@/shared/components/ui/sidebar'

vi.mock('@/shared/hooks/use-status', () => ({
  useStatus: () => ({
    status: { system_name: 'New API', version: 'v0.0.0' },
    loading: false,
  }),
}))

vi.mock('@/shared/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ logo: '/logo.png', loading: false }),
}))

vi.mock('@/shared/hooks/use-top-nav-links', () => ({
  useTopNavLinks: () => [],
}))

vi.mock('@/shared/hooks/use-notifications', () => ({
  useNotifications: () => ({
    popoverOpen: false,
    setPopoverOpen: vi.fn(),
    unreadCount: 0,
    activeTab: 'notice',
    setActiveTab: vi.fn(),
    notice: '',
    announcements: [],
    loading: false,
    signedIn: false,
    inbox: [],
    inboxLoading: false,
    dismissInboxItem: vi.fn(),
    markInboxRead: vi.fn(),
  }),
}))

vi.mock('@/shared/context/theme-provider', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/shared/features/system-update/system-update-action', () => ({
  SystemUpdateAction: () => null,
}))

async function renderHeader() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SidebarProvider>
          <AppHeader />
        </SidebarProvider>
      ),
    }),
    history: createMemoryHistory({
      initialEntries: ['/app/workspace/overview'],
    }),
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
})

describe('client app header brand', () => {
  it('renders the Astramux wordmark without any responsive hiding', async () => {
    await renderHeader()

    const wordmark = screen.getByText('Astramux')
    expect(wordmark).toBeInTheDocument()
    // The wordmark must never carry a class that hides or truncates it at a
    // breakpoint; it is the only place the brand name appears on a phone.
    expect(wordmark.className).not.toMatch(/\bhidden\b/)
    expect(wordmark.className).not.toMatch(/\bsr-only\b/)
    expect(wordmark.className).not.toMatch(/\btruncate\b/)
    expect(wordmark.className).toContain('whitespace-nowrap')
    expect(wordmark.className).not.toMatch(/max-w-/)
  })

  it('keeps the logo next to the wordmark with a fixed size', async () => {
    await renderHeader()

    const logo = screen.getByAltText('Logo')
    expect(logo.className).toContain('size-6')
    expect(logo.className).toContain('shrink-0')
  })

  it('exposes exactly three size-9 utilities: notifications, theme, language', async () => {
    await renderHeader()

    for (const label of ['Notifications', 'Toggle theme', 'Change language']) {
      const button = screen.getByRole('button', { name: label })
      expect(button.className).toContain('size-9')
      expect(button.className).not.toContain('size-8')
    }
    // The header no longer carries an account avatar.
    expect(document.querySelector('[data-slot="avatar"]')).toBeNull()
  })
})
