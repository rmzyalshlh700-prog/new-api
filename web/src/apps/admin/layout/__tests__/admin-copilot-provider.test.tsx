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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { AdminCopilotProvider } from '../admin-copilot-provider'

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
      const body = String(input).endsWith('/chat/info') ? CHAT_INFO : CHAT_REPLY
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('sending a message keeps the admin shell mounted and renders the reply', async () => {
  const user = userEvent.setup()
  render(
    <AdminCopilotProvider>
      <div>admin shell</div>
    </AdminCopilotProvider>,
  )

  const toggle = screen
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-label') === 'Open Chat')
  expect(toggle).toBeDefined()
  await user.click(toggle as HTMLElement)


  const textbox = await screen.findByRole('textbox')
  await user.type(textbox, 'hello there')
  await user.keyboard('{Enter}')

  expect(await screen.findByText('hello there')).toBeInTheDocument()
  expect(screen.getByText('admin shell')).toBeInTheDocument()
})
