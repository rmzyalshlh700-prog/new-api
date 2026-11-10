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
import { queryOptions } from '@tanstack/react-query'

import { api } from '@/shared/lib/api'

export interface MaintenanceProbe {
  enabled: boolean
  bypass: boolean
}

const MAINTENANCE_EXEMPT_PATHS = new Set([
  '/maintenance',
  '/setup',
  '/login',
  '/sign-in',
  '/sign-up',
  '/register',
  '/forgot-password',
  '/reset',
  '/otp',
  '/admin/login',
  '/401',
  '/403',
  '/404',
  '/500',
  '/503',
])

export function isMaintenanceExemptPath(pathname: string): boolean {
  return (
    MAINTENANCE_EXEMPT_PATHS.has(pathname) || pathname.startsWith('/oauth/')
  )
}

export function shouldRedirectToMaintenance(
  pathname: string,
  probe: MaintenanceProbe | null | undefined
): boolean {
  if (isMaintenanceExemptPath(pathname)) return false
  return probe?.enabled === true && probe.bypass !== true
}

async function fetchMaintenanceProbe(): Promise<MaintenanceProbe | null> {
  const response = await api.get('/api/status/maintenance', {
    disableDuplicate: true,
  })
  const data = response.data?.data
  if (!data || typeof data.enabled !== 'boolean') return null
  return { enabled: data.enabled, bypass: data.bypass === true }
}

/**
 * Maintenance state for the router guard. A short stale window keeps intent
 * preloads from probing on every hover, while the HTTP interceptor still
 * catches maintenance enabled after the probe was cached.
 */
export function maintenanceProbeQueryOptions(sessionId: string | null) {
  return queryOptions({
    queryKey: ['maintenance', 'probe', sessionId ?? 'anonymous'],
    queryFn: fetchMaintenanceProbe,
    staleTime: 10_000,
    gcTime: 30_000,
    retry: false,
  })
}
