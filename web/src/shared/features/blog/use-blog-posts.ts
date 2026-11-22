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
import { useQuery } from '@tanstack/react-query'

import { getPublicBlogPosts } from '@/shared/features/public-content/api'
import type { BlogPost } from '@/shared/features/public-content/types'

import { SEED_BLOG_POSTS } from './seed-posts'

/**
 * Merge administrator-managed posts with the editorial seed. A managed post
 * with the same slug replaces its seed, so publishing an edit takes effect
 * without deleting anything.
 */
export function mergeBlogPosts(managed: BlogPost[]): BlogPost[] {
  const managedSlugs = new Set(managed.map((post) => post.slug))
  return [
    ...managed,
    ...SEED_BLOG_POSTS.filter((post) => !managedSlugs.has(post.slug)),
  ]
    .filter((post) => post.published)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function useBlogPosts() {
  const query = useQuery({
    queryKey: ['public-blog-posts'],
    queryFn: getPublicBlogPosts,
    staleTime: 60_000,
  })

  return {
    posts: mergeBlogPosts(query.data ?? []),
    isLoading: query.isLoading,
  }
}
