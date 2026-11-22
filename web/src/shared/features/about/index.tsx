import { useQuery } from '@tanstack/react-query'
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
import { Activity, Gauge, Globe, Layers, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/shared/components/layout'
import { RichContent } from '@/shared/components/rich-content'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ASTRAMUX_SUPPORT_URL } from '@/shared/lib/astramux'
import { isHttpUrl, isLikelyHtml } from '@/shared/lib/content-format'
import { requireServerSuccess } from '@/shared/lib/server-error-message'

import { getAboutContent } from './api'

function SectionHeading(props: { children: React.ReactNode }) {
  return (
    <h2 className='mb-4 text-lg font-semibold tracking-tight'>
      {props.children}
    </h2>
  )
}

function Pillar(props: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className='border-border bg-card rounded-xl border p-5'>
      <span className='text-foreground/70 inline-flex size-5 items-center justify-center [&_svg]:size-5'>
        {props.icon}
      </span>
      <h3 className='mt-4 text-sm font-semibold'>{props.title}</h3>
      <p className='text-muted-foreground mt-1.5 text-[13px] leading-relaxed'>
        {props.children}
      </p>
    </div>
  )
}

function AboutStory() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <span className='border-border text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'>
        {t('About Astramux')}
      </span>
      <h1 className='mt-5 max-w-3xl text-3xl leading-[1.1] font-semibold tracking-tight sm:text-[2.6rem]'>
        {t('One reliable path from your product to every model.')}
      </h1>
      <p className='text-muted-foreground mt-5 max-w-2xl text-[15px] leading-relaxed'>
        {t(
          'Astramux is an inference gateway. We keep a stable API in front of a changing set of model providers so your team ships product instead of maintaining routing, credentials and billing for each one.'
        )}
      </p>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[15px] leading-relaxed'>
        {t(
          'Our mission is simple: make model access boring. One endpoint, one key, one bill, and honest numbers about what each request cost.'
        )}
      </p>

      <div className='mt-10'>
        <SectionHeading>{t('Architecture pillars')}</SectionHeading>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          <Pillar icon={<Layers />} title={t('Unified protocol layer')}>
            {t(
              'OpenAI-compatible endpoints plus native Anthropic and Gemini formats share one routing and billing core.'
            )}
          </Pillar>
          <Pillar icon={<Activity />} title={t('Health-aware routing')}>
            {t(
              'Requests reach a healthy upstream first; failures before the first token are retried invisibly.'
            )}
          </Pillar>
          <Pillar icon={<Gauge />} title={t('Transparent metering')}>
            {t(
              'Token usage, price and the serving route are recorded for every request, in one ledger.'
            )}
          </Pillar>
        </div>
      </div>

      <div className='mt-10'>
        <SectionHeading>{t('Reliability commitments')}</SectionHeading>
        <div className='grid gap-3 sm:grid-cols-3'>
          <Pillar icon={<ShieldCheck />} title={t('No silent replay')}>
            {t(
              'A stream is never restarted after output begins. You always know what your user received.'
            )}
          </Pillar>
          <Pillar icon={<Globe />} title={t('Provider independence')}>
            {t(
              'A single provider outage does not take your integration down with it.'
            )}
          </Pillar>
          <Pillar icon={<Activity />} title={t('Visible status')}>
            {t(
              'Errors carry a code and a meaning, and switches appear in the usage log.'
            )}
          </Pillar>
        </div>
      </div>

      <div className='mt-10'>
        <SectionHeading>{t('Transparent billing')}</SectionHeading>
        <div className='border-border bg-card flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-start sm:justify-between'>
          <div className='max-w-xl'>
            <p className='text-sm font-semibold'>
              {t('Pay only for the tokens you use.')}
            </p>
            <p className='text-muted-foreground mt-1.5 text-[13px] leading-relaxed'>
              {t(
                'There are no seats, minimums or platform fees. Each request is priced from the live table for the model that served it and deducted from your balance. Key budgets cap a single service; the account balance caps everything.'
              )}
            </p>
          </div>
          <Link
            to='/pricing'
            className='border-border hover:bg-muted inline-flex h-9 shrink-0 items-center justify-center rounded-lg border px-4 text-[13px] font-medium transition-colors'
          >
            {t('See model prices')}
          </Link>
        </div>
      </div>

      <div className='border-border bg-card mt-10 flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-sm font-semibold'>{t('Talk to the team')}</p>
          <p className='text-muted-foreground mt-1 text-[13px]'>
            {t('Support and account questions: @Astramux_Support')}
          </p>
        </div>
        <a
          href={ASTRAMUX_SUPPORT_URL}
          target='_blank'
          rel='noopener noreferrer'
          className='bg-foreground text-background inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-opacity hover:opacity-90'
        >
          {t('Contact support')}
        </a>
      </div>

      <div className='text-muted-foreground border-border mt-12 border-t pt-5 text-[11.5px] leading-relaxed'>
        <p>
          {t('Astramux is built on')}{' '}
          <a
            href='https://github.com/QuantumNous/new-api'
            target='_blank'
            rel='noopener noreferrer'
            className='hover:text-foreground underline'
          >
            {t('New API')}
          </a>{' '}
          {t('and is distributed under the')}{' '}
          <a
            href='https://github.com/QuantumNous/new-api/blob/main/LICENSE'
            target='_blank'
            rel='noopener noreferrer'
            className='hover:text-foreground underline'
          >
            {t('AGPL v3.0 License')}
          </a>
          . © 2026 Astramux.
        </p>
      </div>
    </div>
  )
}

export function About() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: async () => requireServerSuccess(await getAboutContent()),
  })

  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto flex max-w-4xl flex-col gap-4 py-12'>
          <Skeleton className='h-8 w-[45%]' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-[90%]' />
          <Skeleton className='h-4 w-[80%]' />
        </div>
      </PublicLayout>
    )
  }

  // An administrator can still replace this page with custom HTML or a URL.
  if (hasContent) {
    if (isHttpUrl(rawContent)) {
      return (
        <PublicLayout showMainContainer={false}>
          <iframe
            src={rawContent}
            className='h-[calc(100vh-3.5rem)] w-full border-0'
            title={t('About')}
            sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts'
          />
        </PublicLayout>
      )
    }

    if (isLikelyHtml(rawContent)) {
      return (
        <PublicLayout showMainContainer={false}>
          <RichContent
            mode='html'
            htmlVariant='isolated'
            content={rawContent}
            className='prose-neutral dark:prose-invert max-w-none'
          />
        </PublicLayout>
      )
    }

    return (
      <PublicLayout>
        <div className='mx-auto max-w-6xl px-4 py-8'>
          <RichContent
            mode='markdown'
            content={rawContent}
            className='prose-neutral dark:prose-invert max-w-none'
          />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-5xl px-5 pt-24 pb-16 sm:px-6 lg:pt-28'>
        <AboutStory />
      </div>
    </PublicLayout>
  )
}
