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
import { lazy } from 'react'

/**
 * VChart (@visactor + zrender) is ~2 MB raw / ~560 kB gzipped and is only
 * needed once a chart actually renders. Importing it lazily keeps it out of
 * every route chunk that merely mentions a chart. Render inside <Suspense>
 * with a fixed-height container so the swap does not shift layout.
 */
export const VChart = lazy(() =>
  import('@visactor/react-vchart').then((module) => ({
    default: module.VChart,
  }))
)
