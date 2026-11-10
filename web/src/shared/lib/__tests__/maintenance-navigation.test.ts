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
import { AxiosError, type AxiosAdapter } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '../http-client'

const originalLocation = window.location
const originalAdapter = api.defaults.adapter

function stubLocation(pathname: string): ReturnType<typeof vi.fn> {
  const replace = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { pathname, replace, href: '', origin: 'http://localhost' },
  })
  return replace
}

function unavailableAdapter(data: unknown): AxiosAdapter {
  return async (config) => {
    throw new AxiosError(
      'Service Unavailable',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        data,
        status: 503,
        statusText: 'Service Unavailable',
        headers: {},
        config,
      }
    )
  }
}

afterEach(() => {
  api.defaults.adapter = originalAdapter
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  })
})

it('a maintenance 503 sends the user to the maintenance page', async () => {
  const replace = stubLocation('/dashboard')
  api.defaults.adapter = unavailableAdapter({
    success: false,
    message: 'System under maintenance',
    maintenance_active: true,
  })

  await expect(api.get('/api/user/self')).rejects.toBeInstanceOf(AxiosError)

  expect(replace).toHaveBeenCalledWith('/maintenance')
})

it('keeps the current page when the maintenance page itself gets a 503', async () => {
  const replace = stubLocation('/maintenance')
  api.defaults.adapter = unavailableAdapter({
    success: false,
    message: 'System under maintenance',
    maintenance_active: true,
  })

  await expect(api.get('/api/user/self')).rejects.toBeInstanceOf(AxiosError)

  expect(replace).not.toHaveBeenCalled()
})

it('does not treat an unrelated 503 as maintenance', async () => {
  const replace = stubLocation('/dashboard')
  api.defaults.adapter = unavailableAdapter({
    success: false,
    message: 'Upstream unavailable',
  })

  await expect(api.get('/api/user/self')).rejects.toBeInstanceOf(AxiosError)

  expect(replace).not.toHaveBeenCalled()
})
