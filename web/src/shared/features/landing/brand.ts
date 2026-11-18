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
/** Brand values the landing page consumes from its host app. */
export type LandingBrand = {
  systemName: string
  logoUrl: string
}

/** Fallbacks used when the host passes nothing, matching the console. */
export const DEFAULT_LANDING_BRAND: LandingBrand = {
  systemName: 'Astramux',
  logoUrl: '/logo.png',
}
