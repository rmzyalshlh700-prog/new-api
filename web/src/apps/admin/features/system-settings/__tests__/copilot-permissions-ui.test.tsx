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

import {
  ALL_ADMIN_COPILOT_TOOLS,
  ADMIN_COPILOT_TOOLS,
} from '@/apps/admin/layout/admin-copilot-config'
import { api } from '@/shared/lib/http-client'

import { CopilotSettings } from '../CopilotSettings'

const PERMISSIONS_URL = '/api/admin/copilot/permissions'

const SETTINGS = {
  base_url: 'https://api.example.com/v1',
  model: 'gpt-test',
  enabled_tools: ALL_ADMIN_COPILOT_TOOLS,
  master_control: true,
  visibility: 'all',
  api_key_configured: true,
}

const ALL_GRANTED: Record<string, boolean> = Object.fromEntries(
  ADMIN_COPILOT_TOOLS.map((tool) => [tool.name, true])
)

function permissionsAnswer(permissions: Record<string, boolean>) {
  const master = ADMIN_COPILOT_TOOLS.every((tool) => permissions[tool.name])
  return {
    master_control: master,
    permissions,
    catalog: ADMIN_COPILOT_TOOLS.map((tool) => ({
      name: tool.name,
      group: tool.group,
      risk: tool.risk,
    })),
    groups: [...new Set(ADMIN_COPILOT_TOOLS.map((tool) => tool.group))],
  }
}

// The switch control exposes both a labelled span and a hidden input, so the
// tests address it by its role and accessible name.
function toolSwitch(name: string) {
  return screen.getByRole('switch', { name })
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

describe('Copilot permission matrix', () => {
  it('renders the master switch on while every tool is granted', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => ({
      data: {
        success: true,
        message: '',
        data: url === PERMISSIONS_URL ? permissionsAnswer(ALL_GRANTED) : SETTINGS,
      },
    }))
    renderSettings()

    const master = await screen.findByRole('switch', { name: 'Master Control' })
    await waitFor(() => expect(master).toBeChecked())
    expect(
      toolSwitch('Allow listing channels')
    ).toBeChecked()
  })

  it('turns the master switch off as soon as one tool is switched off', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => ({
      data: {
        success: true,
        message: '',
        data: url === PERMISSIONS_URL ? permissionsAnswer(ALL_GRANTED) : SETTINGS,
      },
    }))
    const user = renderSettings()

    const master = await screen.findByRole('switch', { name: 'Master Control' })
    await waitFor(() => expect(master).toBeChecked())

    await user.click(toolSwitch('Allow listing channels'))

    await waitFor(() => expect(master).not.toBeChecked())
    expect(toolSwitch('Allow listing channels')).not.toBeChecked()
  })

  it('grants everything from the master switch and writes the matrix', async () => {
    let stored: Record<string, boolean> = { ...ALL_GRANTED, listChannels: false }
    const put = vi
      .spyOn(api, 'put')
      .mockImplementation(async (_url: string, body: unknown) => {
        const request = body as {
          master_control?: boolean
          permissions?: Record<string, boolean>
        }
        if (request.permissions) stored = request.permissions
        return {
          data: {
            success: true,
            message: '',
            data: permissionsAnswer(stored),
          },
        }
      })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => ({
      data: {
        success: true,
        message: '',
        data: url === PERMISSIONS_URL ? permissionsAnswer(stored) : SETTINGS,
      },
    }))
    const user = renderSettings()

    const master = await screen.findByRole('switch', { name: 'Master Control' })
    await waitFor(() => expect(master).not.toBeChecked())
    expect(toolSwitch('Allow listing channels')).not.toBeChecked()

    await user.click(master)
    await user.click(screen.getByRole('button', { name: 'Save permissions' }))

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const [url, body] = put.mock.calls[0] as [
      string,
      { master_control: boolean; permissions: Record<string, boolean> },
    ]
    expect(url).toBe(PERMISSIONS_URL)
    expect(body.master_control).toBe(true)
    expect(body.permissions).toEqual(ALL_GRANTED)

    await waitFor(() =>
      expect(
        toolSwitch('Allow listing channels')
      ).toBeChecked()
    )
  })

  it('asks before granting a destructive permission', async () => {
    const stored: Record<string, boolean> = Object.fromEntries(
      ADMIN_COPILOT_TOOLS.map((tool) => [
        tool.name,
        tool.risk !== 'destructive',
      ])
    )
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => ({
      data: {
        success: true,
        message: '',
        data: url === PERMISSIONS_URL ? permissionsAnswer(stored) : SETTINGS,
      },
    }))
    const user = renderSettings()

    const destructive = await screen.findByRole('switch', { name: 'Allow deleting channels' })
    expect(destructive).not.toBeChecked()

    await user.click(destructive)

    expect(
      await screen.findByText('Allow a destructive action?')
    ).toBeVisible()
    expect(destructive).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Grant the permission' }))
    await waitFor(() => expect(destructive).toBeChecked())
  })
})
