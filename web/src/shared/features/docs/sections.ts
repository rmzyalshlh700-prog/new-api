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
import {
  Boxes,
  Braces,
  KeyRound,
  Plug,
  Receipt,
  Rocket,
  Route,
  Share2,
  TriangleAlert,
  BookOpen,
} from 'lucide-react'

export const DOCS_SECTIONS = [
  'overview',
  'quickstart',
  'authentication',
  'integrations',
  'routing',
  'models',
  'openai-compatible',
  'provider-native',
  'billing-and-keys',
  'errors-and-retries',
] as const

export type DocsSectionId = (typeof DOCS_SECTIONS)[number]

export type DocsNavItem = {
  id: DocsSectionId
  labelKey: string
  icon: typeof BookOpen
}

export type DocsNavGroup = {
  id: string
  titleKey: string
  items: DocsNavItem[]
}

export const DOCS_NAV: DocsNavGroup[] = [
  {
    id: 'get-started',
    titleKey: 'Get Started',
    items: [
      { id: 'overview', labelKey: 'Overview', icon: BookOpen },
      { id: 'quickstart', labelKey: 'Quickstart', icon: Rocket },
      { id: 'authentication', labelKey: 'Authentication', icon: KeyRound },
      { id: 'integrations', labelKey: 'Integrations', icon: Plug },
    ],
  },
  {
    id: 'core-concepts',
    titleKey: 'Core Concepts',
    items: [
      { id: 'routing', labelKey: 'Routing', icon: Route },
      { id: 'models', labelKey: 'Models', icon: Boxes },
    ],
  },
  {
    id: 'api-reference',
    titleKey: 'API Reference',
    items: [
      { id: 'openai-compatible', labelKey: 'OpenAI-compatible', icon: Braces },
      {
        id: 'provider-native',
        labelKey: 'Provider-native APIs',
        icon: Share2,
      },
      {
        id: 'billing-and-keys',
        labelKey: 'Billing & Keys',
        icon: Receipt,
      },
      {
        id: 'errors-and-retries',
        labelKey: 'Errors & Retries',
        icon: TriangleAlert,
      },
    ],
  },
]

export const DOCS_DEFAULT_SECTION: DocsSectionId = 'overview'

export function isDocsSectionId(value: string): value is DocsSectionId {
  return (DOCS_SECTIONS as readonly string[]).includes(value)
}
