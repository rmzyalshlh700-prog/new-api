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
import {
  Boxes,
  Braces,
  KeyRound,
  Plug,
  Route,
  Rocket,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils'

import {
  DocsCallout,
  DocsCard,
  DocsCodeBlock,
  DocsList,
  DocsParagraph,
  DocsSectionTitle,
} from '../components'

const CURL_SNIPPET = `curl https://astramux.com/v1/chat/completions \\
  -H "Authorization: Bearer $ASTRAMUX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{ "role": "user", "content": "Hello, Astramux" }]
  }'`

const NODE_SNIPPET = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.ASTRAMUX_API_KEY,
  baseURL: "https://astramux.com/v1",
});

const reply = await client.chat.completions.create({
  model: "gpt-4.1-mini",
  messages: [{ role: "user", content: "Hello, Astramux" }],
});

console.log(reply.choices[0].message.content);`

const PYTHON_SNIPPET = `from openai import OpenAI

client = OpenAI(
    api_key="ASTRAMUX_API_KEY",
    base_url="https://astramux.com/v1",
)

reply = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content": "Hello, Astramux"}],
)

print(reply.choices[0].message.content)`

export function OverviewPage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <span className='border-border text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'>
        {t('Developer documentation')}
      </span>
      <h1 className='mt-5 text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl'>
        {t('One API. Every model.')}
      </h1>
      <p className='text-muted-foreground mt-4 max-w-2xl text-[15px] leading-relaxed'>
        {t(
          'Integrate once to reach every major model, route around provider incidents, and keep one predictable bill. Astramux speaks the OpenAI schema and the native Anthropic and Gemini formats.'
        )}
      </p>

      <Link
        to='/docs/$section'
        params={{ section: 'quickstart' }}
        className='bg-foreground text-background mt-7 inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-medium transition-opacity hover:opacity-90'
      >
        {t('Make your first request')}
        <span aria-hidden='true'>→</span>
      </Link>

      <div className='mt-10 grid gap-3 sm:grid-cols-2'>
        <DocsCard
          icon={<Rocket />}
          title={t('Make your first request')}
          href='/docs/quickstart'
          linkLabel={t('Start the quickstart')}
        >
          {t(
            'Create a key, list the models you can reach, and send an OpenAI-compatible chat request.'
          )}
        </DocsCard>
        <DocsCard
          icon={<Route />}
          title={t('Understand the router')}
          href='/docs/routing'
          linkLabel={t('Read about routing')}
        >
          {t(
            'See how health, availability and latency determine which upstream serves each request.'
          )}
        </DocsCard>
        <DocsCard
          icon={<Boxes />}
          title={t('Choose a model')}
          href='/docs/models'
          linkLabel={t('Explore models')}
        >
          {t(
            'Discover live model IDs, context limits and the endpoint that serves them.'
          )}
        </DocsCard>
        <DocsCard
          icon={<Braces />}
          title={t('Integrate an API')}
          href='/docs/openai-compatible'
          linkLabel={t('Browse the API reference')}
        >
          {t(
            'Use OpenAI-compatible endpoints or keep your existing Anthropic and Gemini clients.'
          )}
        </DocsCard>
      </div>

      <DocsSectionTitle>{t('Built for routed inference')}</DocsSectionTitle>
      <DocsParagraph>
        {t(
          'Your application keeps a stable contract while capacity, provider health and model availability change behind it.'
        )}
      </DocsParagraph>

      <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        <DocsCard icon={<KeyRound />} title={t('One authenticated API')}>
          {t(
            'A single key works across every model and every supported protocol.'
          )}
        </DocsCard>
        <DocsCard icon={<ShieldCheck />} title={t('Health-aware failover')}>
          {t(
            'Requests move to a healthy upstream when a provider degrades, without a client-side retry.'
          )}
        </DocsCard>
        <DocsCard icon={<Braces />} title={t('Provider-safe responses')}>
          {t(
            'Upstream credentials stay server side and are never echoed back in a response.'
          )}
        </DocsCard>
      </div>
    </div>
  )
}

const QUICKSTART_TABS = [
  { id: 'curl', label: 'cURL', code: CURL_SNIPPET },
  { id: 'node', label: 'Node', code: NODE_SNIPPET },
  { id: 'python', label: 'Python', code: PYTHON_SNIPPET },
] as const

export function QuickstartPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<(typeof QUICKSTART_TABS)[number]['id']>('curl')
  const active =
    QUICKSTART_TABS.find((item) => item.id === tab) ?? QUICKSTART_TABS[0]

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Quickstart')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Three steps from an empty project to a routed completion. The base URL is always the same: https://astramux.com/v1'
        )}
      </p>

      <DocsSectionTitle>{t('1. Create an API key')}</DocsSectionTitle>
      <DocsParagraph>
        {t(
          'Open the console, choose API Keys, and create a key with a budget that fits the workload. The full key is shown once.'
        )}
      </DocsParagraph>
      <div className='mt-3'>
        <DocsCard
          icon={<KeyRound />}
          title={t('Open API Keys')}
          href='/app/keys'
          linkLabel={t('Create a key')}
        />
      </div>

      <DocsSectionTitle>
        {t('2. Point your client at Astramux')}
      </DocsSectionTitle>
      <DocsParagraph>
        {t(
          'Every official OpenAI SDK accepts a custom base URL. Keep your existing code and change only the endpoint and the key.'
        )}
      </DocsParagraph>

      <div className='border-border mt-4 flex gap-1 border-b pb-2'>
        {QUICKSTART_TABS.map((item) => (
          <button
            key={item.id}
            type='button'
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors',
              tab === item.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className='mt-3 min-w-0'>
        <DocsCodeBlock code={active.code} label={active.label} />
      </div>

      <DocsSectionTitle>{t('3. Read the response')}</DocsSectionTitle>
      <DocsParagraph>
        {t(
          'The response follows the OpenAI chat completion schema, including usage accounting, so existing parsers keep working.'
        )}
      </DocsParagraph>

      <div className='mt-4'>
        <DocsCallout title={t('Streaming')}>
          {t(
            'Send stream: true to receive server-sent events. Each chunk carries a delta; the final chunk reports usage and the model that served the request.'
          )}
        </DocsCallout>
      </div>

      <DocsSectionTitle>{t('Next steps')}</DocsSectionTitle>
      <DocsList
        items={[
          <Link
            key='auth'
            to='/docs/$section'
            params={{ section: 'authentication' }}
            className='underline'
          >
            {t('Authentication')}
          </Link>,
          <Link
            key='models'
            to='/docs/$section'
            params={{ section: 'models' }}
            className='underline'
          >
            {t('Models')}
          </Link>,
          <Link
            key='errors'
            to='/docs/$section'
            params={{ section: 'errors-and-retries' }}
            className='underline'
          >
            {t('Errors & Retries')}
          </Link>,
        ]}
      />
    </div>
  )
}

export function AuthenticationPage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Authentication')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Every request is authenticated with a bearer token issued by the Astramux console. There are no anonymous inference endpoints.'
        )}
      </p>

      <DocsSectionTitle>{t('Bearer keys')}</DocsSectionTitle>
      <DocsCodeBlock
        label='http'
        code='Authorization: Bearer $ASTRAMUX_API_KEY'
      />
      <div className='mt-4'>
        <DocsParagraph>
          {t(
            'Send the header on every call. Keys are scoped to your account, can be rotated at any time, and are revoked immediately when deleted.'
          )}
        </DocsParagraph>
      </div>

      <DocsSectionTitle>{t('Key budgets')}</DocsSectionTitle>
      <DocsList
        items={[
          t(
            'Give each key its own spend limit so one service cannot exhaust the account balance.'
          ),
          t(
            'Restrict a key to the models or groups it needs; anything else is rejected with 403.'
          ),
          t(
            'Use separate keys per environment so a leaked development key can be revoked alone.'
          ),
        ]}
      />

      <DocsSectionTitle>{t('Security')}</DocsSectionTitle>
      <DocsList
        items={[
          t(
            'Keep keys in environment variables or a secret manager, never in client code.'
          ),
          t('Rotate keys on a schedule and after any team change.'),
          t(
            'Watch usage and balance alerts in the console for unexpected spend.'
          ),
          t('Prefer short-lived keys for automated jobs.'),
        ]}
      />

      <div className='mt-5'>
        <DocsCallout
          title={t('Never expose a key in a browser')}
          tone='warning'
        >
          {t(
            'A key embedded in a web page can be copied by any visitor. Proxy requests through your own backend instead.'
          )}
        </DocsCallout>
      </div>
    </div>
  )
}

export function IntegrationsGuidePage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Integrations')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Most tools that accept an OpenAI-compatible endpoint work with Astramux unchanged. Set the base URL and paste a key.'
        )}
      </p>

      <DocsSectionTitle>{t('Universal setup')}</DocsSectionTitle>
      <DocsCodeBlock
        label='env'
        code={
          'ASTRAMUX_BASE_URL=https://astramux.com/v1\nASTRAMUX_API_KEY=your-key'
        }
      />

      <div className='mt-4'>
        <DocsList
          items={[
            t('Base URL: https://astramux.com/v1'),
            t('API key: any key created in the console'),
            t('Model: any live model ID from the Models page'),
          ]}
        />
      </div>

      <DocsSectionTitle>{t('Browse setup guides')}</DocsSectionTitle>
      <DocsCard
        icon={<Plug />}
        title={t('Integrations directory')}
        href='/integrations'
        linkLabel={t('Open integrations')}
      >
        {t(
          'Step-by-step setup cards for SDKs, coding agents, desktop clients and orchestration frameworks.'
        )}
      </DocsCard>
    </div>
  )
}
