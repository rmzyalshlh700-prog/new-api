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
import type { QueryClient } from '@tanstack/react-query'

import { useStatus } from '@/shared/hooks/use-status'
import { readCachedStatus, statusQueryOptions } from '@/shared/lib/status-query'

export type PublicPageKey = 'docs' | 'integrations' | 'about' | 'blog'

export type PublicPageVisibility = Record<PublicPageKey, boolean>

/** Every page starts visible, so an untouched installation exposes the suite. */
export const DEFAULT_PUBLIC_PAGE_VISIBILITY: PublicPageVisibility = {
  docs: true,
  integrations: true,
  about: true,
  blog: true,
}

export const PUBLIC_PAGE_PATHS: Record<PublicPageKey, string> = {
  docs: '/docs',
  integrations: '/integrations',
  about: '/about',
  blog: '/blog',
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return fallback
}

/**
 * Read the `public_pages` block the gateway publishes with `/api/status`.
 *
 * A missing or malformed block keeps every page visible; a disabled page must
 * be an explicit administrator decision, never the result of a failed read.
 */
export function parsePublicPageVisibility(raw: unknown): PublicPageVisibility {
  if (!raw || typeof raw !== 'object')
    return { ...DEFAULT_PUBLIC_PAGE_VISIBILITY }
  const record = raw as Record<string, unknown>
  return {
    docs: parseBoolean(record.docs, true),
    integrations: parseBoolean(record.integrations, true),
    about: parseBoolean(record.about, true),
    blog: parseBoolean(record.blog, true),
  }
}

/** Subscribe to the page switches so a save reaches the footer and sidebar. */
export function usePublicPageVisibility(): PublicPageVisibility {
  const { status } = useStatus()
  return parsePublicPageVisibility(
    (status as Record<string, unknown> | null)?.public_pages
  )
}

/**
 * Resolve visibility for a router guard.
 *
 * Reads through the shared status cache; a stale entry is refreshed first so a
 * freshly saved switch redirects immediately instead of one navigation later.
 */
export async function getPublicPageVisibilityForGuard(
  queryClient: QueryClient
): Promise<PublicPageVisibility> {
  try {
    const status = await queryClient.fetchQuery(statusQueryOptions)
    return parsePublicPageVisibility(status?.public_pages)
  } catch {
    return { ...DEFAULT_PUBLIC_PAGE_VISIBILITY }
  }
}

/** Synchronous read for render paths that cannot await (client sidebar). */
export function getPublicPageVisibility(): PublicPageVisibility {
  return parsePublicPageVisibility(readCachedStatus()?.public_pages)
}
