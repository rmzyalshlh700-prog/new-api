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

/**
 * Navigation hook for maintenance responses.
 *
 * The HTTP client lives below the router in the module graph, so it cannot
 * import the router instance without creating a cycle. `main.tsx` registers a
 * router-based navigator at startup; the location fallback keeps the redirect
 * working in environments where no router has been registered yet.
 */
type MaintenanceNavigator = () => void

let navigator: MaintenanceNavigator | null = null

export function registerMaintenanceRedirect(
  handler: MaintenanceNavigator | null
): void {
  navigator = handler
}

export function redirectToMaintenance(): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/maintenance') return
  if (navigator) {
    navigator()
    return
  }
  window.location.replace('/maintenance')
}
