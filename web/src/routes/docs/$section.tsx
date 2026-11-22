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
import { createFileRoute, redirect } from '@tanstack/react-router'

import { DocsSectionPage } from '@/shared/features/docs/page'
import {
  DOCS_DEFAULT_SECTION,
  isDocsSectionId,
  type DocsSectionId,
} from '@/shared/features/docs/sections'

export const Route = createFileRoute('/docs/$section')({
  beforeLoad: ({ params }) => {
    if (!isDocsSectionId(params.section)) {
      throw redirect({
        to: '/docs/$section',
        params: { section: DOCS_DEFAULT_SECTION },
        replace: true,
      })
    }
  },
  component: DocsSectionRoute,
})

function DocsSectionRoute() {
  const { section } = Route.useParams()
  const resolved: DocsSectionId = isDocsSectionId(section)
    ? section
    : DOCS_DEFAULT_SECTION
  return <DocsSectionPage section={resolved} />
}
