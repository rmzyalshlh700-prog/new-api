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
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/shared/components/layout'
import { RichContent } from '@/shared/components/rich-content'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  resolveLocalizedText,
  type BlogPost,
} from '@/shared/features/public-content/types'
import { toIntlLocale } from '@/shared/i18n/languages'

import { useBlogPosts } from './use-blog-posts'

function formatPostDate(date: string, language: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(toIntlLocale(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function BlogListPage() {
  const { t, i18n } = useTranslation()
  const { posts, isLoading } = useBlogPosts()
  const language = i18n.resolvedLanguage || i18n.language

  const [featured, ...rest] = posts

  let feed: React.ReactNode
  if (isLoading) {
    feed = (
      <div className='mt-10 space-y-4'>
        <Skeleton className='h-40 w-full rounded-xl' />
        <Skeleton className='h-28 w-full rounded-xl' />
      </div>
    )
  } else if (posts.length === 0) {
    feed = (
      <p className='text-muted-foreground mt-12 text-sm'>
        {t('No articles have been published yet.')}
      </p>
    )
  } else {
    feed = (
      <>
        <Link
          to='/blog/$slug'
          params={{ slug: featured.slug }}
          className='border-border bg-card hover:border-foreground/25 mt-10 block rounded-xl border p-6 transition-colors'
        >
          <p className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
            {t('Latest')} · {formatPostDate(featured.date, language)}
          </p>
          <h2 className='mt-3 text-xl font-semibold tracking-tight sm:text-2xl'>
            {resolveLocalizedText(featured.title, language)}
          </h2>
          <p className='text-muted-foreground mt-2 max-w-2xl text-[14px] leading-relaxed'>
            {resolveLocalizedText(featured.summary, language)}
          </p>
          <span className='mt-4 inline-flex items-center gap-1 text-[13px] font-medium'>
            {t('Read article')}
            <span aria-hidden='true'>→</span>
          </span>
        </Link>

        <div className='mt-3 grid gap-3 sm:grid-cols-2'>
          {rest.map((post) => (
            <BlogCard
              key={post.id}
              post={post}
              language={language}
              readLabel={t('Read article')}
            />
          ))}
        </div>
      </>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-5xl px-5 pt-24 pb-16 sm:px-6 lg:pt-28'>
        <span className='border-border text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'>
          {t('Blog')}
        </span>
        <h1 className='mt-5 max-w-3xl text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl'>
          {t('Engineering notes from Astramux.')}
        </h1>
        <p className='text-muted-foreground mt-4 max-w-2xl text-[15px] leading-relaxed'>
          {t(
            'Launch notes, routing internals and billing decisions, written by the team that operates the gateway.'
          )}
        </p>

        {feed}
      </div>
    </PublicLayout>
  )
}

function BlogCard(props: {
  post: BlogPost
  language: string
  readLabel: string
}) {
  return (
    <Link
      to='/blog/$slug'
      params={{ slug: props.post.slug }}
      className='border-border bg-card hover:border-foreground/25 flex min-w-0 flex-col rounded-xl border p-5 transition-colors'
    >
      <p className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
        {formatPostDate(props.post.date, props.language)}
      </p>
      <h2 className='mt-2 text-[15px] font-semibold tracking-tight'>
        {resolveLocalizedText(props.post.title, props.language)}
      </h2>
      <p className='text-muted-foreground mt-1.5 line-clamp-3 text-[13px] leading-relaxed'>
        {resolveLocalizedText(props.post.summary, props.language)}
      </p>
      <span className='mt-4 text-[13px] font-medium'>{props.readLabel} →</span>
    </Link>
  )
}

export function BlogArticlePage(props: { slug: string }) {
  const { t, i18n } = useTranslation()
  const { posts, isLoading } = useBlogPosts()
  const language = i18n.resolvedLanguage || i18n.language
  const post = posts.find((item) => item.slug === props.slug)

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <div className='mt-8 space-y-3'>
        <Skeleton className='h-8 w-2/3' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
      </div>
    )
  } else if (!post) {
    body = (
      <div className='mt-10'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          {t('Article not found')}
        </h1>
        <p className='text-muted-foreground mt-2 text-sm'>
          {t(
            'This article may have been unpublished. Browse the blog index instead.'
          )}
        </p>
      </div>
    )
  } else {
    body = (
      <article className='mt-8 min-w-0'>
        <p className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
          {formatPostDate(post.date, language)}
        </p>
        <h1 className='mt-3 text-3xl leading-[1.15] font-semibold tracking-tight'>
          {resolveLocalizedText(post.title, language)}
        </h1>
        <p className='text-muted-foreground mt-3 text-[15px] leading-relaxed'>
          {resolveLocalizedText(post.summary, language)}
        </p>
        <div className='border-border my-8 border-t' />
        <RichContent
          mode='markdown'
          content={resolveLocalizedText(post.body, language)}
          className='prose-neutral dark:prose-invert max-w-none'
        />
      </article>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-3xl px-5 pt-24 pb-16 sm:px-6 lg:pt-28'>
        <Link
          to='/blog'
          className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors'
        >
          <ArrowLeft className='size-3.5' />
          {t('All articles')}
        </Link>

        {body}
      </div>
    </PublicLayout>
  )
}
