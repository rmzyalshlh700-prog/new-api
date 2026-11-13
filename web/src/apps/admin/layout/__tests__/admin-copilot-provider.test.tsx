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
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { AdminCopilotProvider } from '../admin-copilot-provider'

const RUNTIME_SETTINGS = {
  success: true,
  message: '',
  data: {
    enabled_tools: ['getFinancialSummary', 'lookupUser', 'getSystemHealth'],
    visibility: 'all',
  },
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

// The provider reads the current route to decide dashboard-only visibility and
// publishes it as assistant context; outside a RouterProvider both hooks throw.
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouterState: (options: { select: (state: unknown) => unknown }) =>
    options.select({
      location: {
        pathname: '/admin/system-settings',
        href: '/admin/system-settings',
      },
    }),
}))

const CHAT_INFO = {
  version: '1.87.1',
  agents: { default: { description: 'Admin' } },
}

const CHAT_REPLY = {
  data: {
    generateCopilotResponse: {
      messages: [
        {
          __typename: 'TextMessageOutput',
          id: 'a1',
          role: 'assistant',
          content: 'reply text',
        },
      ],
      status: { __typename: 'Success', code: 'OK' },
      threadId: 't1',
      runId: 'r1',
    },
  },
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      let body: unknown = CHAT_REPLY
      if (url.includes('/copilot/settings')) body = RUNTIME_SETTINGS
      else if (url.endsWith('/chat/info')) body = CHAT_INFO
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the FAB toggles the chat window', async () => {
  const user = userEvent.setup()
  renderWithProviders(
    <AdminCopilotProvider>
      <div>admin shell</div>
    </AdminCopilotProvider>
  )

  const window = document.querySelector('#admin-copilot-window')
  expect(window).not.toBeNull()
  expect(window).toHaveAttribute('aria-hidden', 'true')
  expect(window).toHaveAttribute('inert')

  const toggle = screen.getByRole('button', { name: 'Open Admin Copilot' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await user.click(toggle)

  const closeToggle = screen.getByRole('button', {
    name: 'Close Admin Copilot',
  })
  expect(closeToggle).toHaveAttribute('aria-expanded', 'true')
  expect(window).toHaveAttribute('aria-hidden', 'false')
  expect(window).not.toHaveAttribute('inert')
  expect(window).toHaveClass('open')

  await user.click(closeToggle)
  expect(window).toHaveAttribute('aria-hidden', 'true')
})

test('Escape closes the chat window and keeps the admin shell mounted', async () => {
  const user = userEvent.setup()
  renderWithProviders(
    <AdminCopilotProvider>
      <div>admin shell</div>
    </AdminCopilotProvider>
  )

  await user.click(screen.getByRole('button', { name: 'Open Admin Copilot' }))
  const textbox = await screen.findByRole('textbox')
  await user.type(textbox, 'hello there')
  await user.keyboard('{Enter}')

  expect(await screen.findByText('hello there')).toBeInTheDocument()
  expect(screen.getByText('admin shell')).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(document.querySelector('#admin-copilot-window')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
})
