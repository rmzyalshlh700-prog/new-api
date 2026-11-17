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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/lib/http-client'

import { CopilotSettings } from '../CopilotSettings'

const SETTINGS = {
  base_url: 'https://api.example.com/v1',
  model: 'gpt-test',
  enabled_tools: ['getFinancialSummary', 'lookupUser', 'getSystemHealth'],
  master_control: false,
  visibility: 'all',
  api_key_configured: true,
}

const SETTINGS_URL = '/api/admin/system-settings/copilot'
const PERMISSIONS_URL = '/api/admin/copilot/permissions'

// The page reads two endpoints; answering both from one mock keeps a test that
// is about the settings load from failing on the second request.
const PERMISSIONS = {
  master_control: false,
  permissions: { lookupUser: true, getSystemHealth: true },
  catalog: [],
  groups: [],
}

function answer(url: string) {
  const data = url === PERMISSIONS_URL ? PERMISSIONS : SETTINGS
  return { data: { success: true, message: '', data } }
}

function settingsCalls(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter(([url]) => url === SETTINGS_URL)
}

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CopilotSettings />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Copilot settings page states', () => {
  it('renders a section skeleton instead of a spinner while loading', () => {
    vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
    renderSettings()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading Copilot settings...'
    )
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it('replaces the endless loading state with a retryable error card', async () => {
    // The first settings request fails and every later one succeeds, which is
    // what the Retry button is there for.
    let settingsAttempts = 0
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === SETTINGS_URL && settingsAttempts++ === 0) {
        throw new Error('Copilot settings unavailable')
      }
      return answer(url)
    })
    const user = renderSettings()

    expect(
      await screen.findByText('Copilot settings unavailable')
    ).toBeVisible()
    expect(
      screen.queryByText('Loading Copilot settings...')
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByLabelText('Model ID')).toHaveValue('gpt-test')
    await waitFor(() => expect(settingsCalls(get).length).toBe(2))
  })

  it('shows a 500 failure as an error card whose retry recovers the form', async () => {
    const serverError = Object.assign(
      new Error('Request failed with status code 500'),
      {
        isAxiosError: true,
        response: {
          status: 500,
          data: {
            success: false,
            message: 'Copilot settings could not be loaded',
          },
        },
      }
    )
    let settingsAttempts = 0
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === SETTINGS_URL && settingsAttempts++ === 0) {
        throw serverError
      }
      return answer(url)
    })
    const user = renderSettings()

    expect(
      await screen.findByText('Failed to load Copilot settings')
    ).toBeVisible()
    expect(
      screen.getByText('Copilot settings could not be loaded')
    ).toBeVisible()
    expect(
      screen.queryByText('Loading Copilot settings...')
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByLabelText('Model ID')).toHaveValue('gpt-test')
    await waitFor(() => expect(settingsCalls(get).length).toBe(2))
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument()
  })

  it('labels the model combobox so the field has an accessible name', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => answer(url))
    renderSettings()

    expect(await screen.findByLabelText('Model ID')).toHaveAttribute(
      'id',
      'copilot-model'
    )
  })
})
