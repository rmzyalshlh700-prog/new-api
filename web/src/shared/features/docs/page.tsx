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
import { DocsPage } from './index'
import { ModelsPage, RoutingPage } from './pages/concepts'
import {
  AuthenticationPage,
  IntegrationsGuidePage,
  OverviewPage,
  QuickstartPage,
} from './pages/get-started'
import {
  BillingAndKeysPage,
  ErrorsAndRetriesPage,
  OpenAiCompatiblePage,
  ProviderNativePage,
} from './pages/reference'
import type { DocsSectionId } from './sections'

function DocsContent(props: { section: DocsSectionId }) {
  switch (props.section) {
    case 'quickstart':
      return <QuickstartPage />
    case 'authentication':
      return <AuthenticationPage />
    case 'integrations':
      return <IntegrationsGuidePage />
    case 'routing':
      return <RoutingPage />
    case 'models':
      return <ModelsPage />
    case 'openai-compatible':
      return <OpenAiCompatiblePage />
    case 'provider-native':
      return <ProviderNativePage />
    case 'billing-and-keys':
      return <BillingAndKeysPage />
    case 'errors-and-retries':
      return <ErrorsAndRetriesPage />
    default:
      return <OverviewPage />
  }
}

export function DocsSectionPage(props: { section: DocsSectionId }) {
  return (
    <DocsPage section={props.section}>
      <DocsContent section={props.section} />
    </DocsPage>
  )
}
