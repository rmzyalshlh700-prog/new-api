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
import { Boxes, Gauge, Route, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DocsCallout,
  DocsCard,
  DocsCodeBlock,
  DocsList,
  DocsParagraph,
  DocsSectionTitle,
} from '../components'

export function RoutingPage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Routing')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Astramux resolves each request against the live pool of upstream providers for the requested model, then picks a route that can serve it now.'
        )}
      </p>

      <DocsSectionTitle>{t('How a route is chosen')}</DocsSectionTitle>
      <DocsList
        items={[
          t(
            'Filter to the upstreams that expose the requested model and protocol.'
          ),
          t(
            'Drop any upstream that is disabled, rate limited or failing its health probes.'
          ),
          t(
            'Prefer the lowest effective cost within the healthy set, weighted by configured priority.'
          ),
          t(
            'Retry the next candidate when an upstream returns a retryable error before any output is sent.'
          ),
        ]}
      />

      <div className='mt-5'>
        <DocsCallout title={t('Failover is invisible to your client')}>
          {t(
            'When a provider fails before the first token, Astramux serves the request from another healthy upstream. You receive one normal response, not an error.'
          )}
        </DocsCallout>
      </div>

      <DocsSectionTitle>{t('Health and recovery')}</DocsSectionTitle>
      <DocsList
        items={[
          t(
            'Upstreams that repeatedly fail are disabled automatically and re-checked on a timer.'
          ),
          t(
            'Streaming requests are never silently restarted after output has begun.'
          ),
          t(
            'Rate limits are measured per key and per account, independent of upstream quotas.'
          ),
        ]}
      />

      <div className='mt-6 grid gap-3 sm:grid-cols-2'>
        <DocsCard icon={<Route />} title={t('Multi-provider by default')}>
          {t(
            'The same model can be served by several upstreams at once, with no change to your code.'
          )}
        </DocsCard>
        <DocsCard icon={<ShieldCheck />} title={t('Graceful degradation')}>
          {t(
            'When no healthy upstream can serve a model, the API answers with a clear 503 instead of hanging.'
          )}
        </DocsCard>
      </div>
    </div>
  )
}

export function ModelsPage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Models')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Model IDs are stable strings you pass as model in every request. List them from the API so your application never depends on a hard-coded catalogue.'
        )}
      </p>

      <DocsSectionTitle>{t('List live models')}</DocsSectionTitle>
      <DocsCodeBlock
        label='bash'
        code={
          'curl https://astramux.com/v1/models \\\n  -H "Authorization: Bearer $ASTRAMUX_API_KEY"'
        }
      />
      <div className='mt-3'>
        <DocsParagraph>
          {t(
            'The response is the OpenAI model list shape: each entry carries an id, an owner and creation time. Only models enabled for your account are returned.'
          )}
        </DocsParagraph>
      </div>

      <DocsSectionTitle>{t('Choosing a model')}</DocsSectionTitle>
      <DocsList
        items={[
          t(
            'Use a small, fast model for routing, classification and extraction.'
          ),
          t(
            'Use a frontier model for multi-step reasoning and long context work.'
          ),
          t(
            'Check context limits before sending long documents; oversized requests are rejected with 400.'
          ),
          t(
            'Compare live prices per model on the pricing page before switching.'
          ),
        ]}
      />

      <div className='mt-5 grid gap-3 sm:grid-cols-2'>
        <DocsCard
          icon={<Boxes />}
          title={t('Model catalogue')}
          href='/pricing'
          linkLabel={t('Compare models and prices')}
        >
          {t(
            'Browse every model available on this deployment with its price, context window and capabilities.'
          )}
        </DocsCard>
        <DocsCard
          icon={<Gauge />}
          title={t('Rankings')}
          href='/rankings'
          linkLabel={t('See rankings')}
        >
          {t('Review model popularity and live usage across the platform.')}
        </DocsCard>
      </div>

      <DocsSectionTitle>{t('Model naming')}</DocsSectionTitle>
      <DocsParagraph>
        {t(
          'Request a model by the exact ID returned by /v1/models. Aliases are deployment specific, so read the list instead of guessing a provider name.'
        )}
      </DocsParagraph>
      <p className='text-muted-foreground mt-3 text-[13px]'>
        <Link
          to='/docs/$section'
          params={{ section: 'openai-compatible' }}
          className='underline'
        >
          {t('See the OpenAI-compatible reference')}
        </Link>
      </p>
    </div>
  )
}
