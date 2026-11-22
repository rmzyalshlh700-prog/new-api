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
import { describe, expect, it } from 'vitest'

import { SEED_BLOG_POSTS } from '@/shared/features/blog/seed-posts'
import { mergeBlogPosts } from '@/shared/features/blog/use-blog-posts'

import { parsePublicPageVisibility } from '../visibility'

describe('public page visibility', () => {
  it('keeps every page visible when the status block is missing', () => {
    expect(parsePublicPageVisibility(undefined)).toEqual({
      docs: true,
      integrations: true,
      about: true,
      blog: true,
    })
  })

  it('honours explicit switches and ignores unusable values', () => {
    expect(
      parsePublicPageVisibility({
        docs: false,
        integrations: 'false',
        about: 'true',
        blog: 'unexpected',
      })
    ).toEqual({
      docs: false,
      integrations: false,
      about: true,
      blog: true,
    })
  })
})

describe('blog feed merge', () => {
  it('publishes the seed and sorts newest first', () => {
    const posts = mergeBlogPosts([])
    expect(posts.length).toBe(SEED_BLOG_POSTS.length)
    const dates = posts.map((post) => post.date)
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)))
  })

  it('replaces a seed with a managed post that shares its slug', () => {
    const managed = {
      ...SEED_BLOG_POSTS[0],
      id: 'managed-release',
      title: { en: 'Managed title', ar: '', ru: '' },
    }
    const posts = mergeBlogPosts([managed])
    const sameSlug = posts.filter((post) => post.slug === managed.slug)
    expect(sameSlug).toHaveLength(1)
    expect(sameSlug[0].id).toBe('managed-release')
  })

  it('never exposes a draft', () => {
    const draft = {
      ...SEED_BLOG_POSTS[0],
      id: 'draft',
      slug: 'draft',
      published: false,
    }
    expect(mergeBlogPosts([draft]).some((post) => post.slug === 'draft')).toBe(
      false
    )
  })
})
