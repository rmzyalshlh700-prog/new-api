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
  Bot,
  MonitorSmartphone,
  Search,
  Terminal,
  Workflow,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/shared/components/layout'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

export const ASTRAMUX_BASE_URL = 'https://astramux.com/v1'

type IntegrationCategory = 'sdk' | 'agent' | 'client' | 'framework'

type Integration = {
  id: string
  name: string
  category: IntegrationCategory
  descriptionKey: string
}

const CATEGORIES: { id: IntegrationCategory | 'all'; labelKey: string }[] = [
  { id: 'all', labelKey: 'All' },
  { id: 'sdk', labelKey: 'SDKs' },
  { id: 'agent', labelKey: 'Coding agents' },
  { id: 'client', labelKey: 'Clients' },
  { id: 'framework', labelKey: 'Frameworks' },
]

const INTEGRATIONS: Integration[] = [
  {
    id: 'openai-sdk',
    name: 'OpenAI SDK',
    category: 'sdk',
    descriptionKey:
      'Point baseURL at Astramux and keep every chat, tool and embedding call exactly as written.',
  },
  {
    id: 'anthropic-sdk',
    name: 'Anthropic SDK',
    category: 'sdk',
    descriptionKey:
      'Send native Anthropic messages to Astramux and route Claude models without a custom proxy.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'agent',
    descriptionKey:
      'Use Astramux as an OpenAI-compatible provider so the editor can reach every configured model.',
  },
  {
    id: 'cline',
    name: 'Cline',
    category: 'agent',
    descriptionKey:
      'Select the OpenAI-compatible provider in Cline and set the base URL to Astramux.',
  },
  {
    id: 'roo-code',
    name: 'Roo Code',
    category: 'agent',
    descriptionKey:
      'Add Astramux as an OpenAI-compatible endpoint and pick the model from your account catalogue.',
  },
  {
    id: 'open-webui',
    name: 'Open WebUI',
    category: 'client',
    descriptionKey:
      'Connect the OpenAI connection settings to Astramux to expose your models in the chat UI.',
  },
  {
    id: 'nextchat',
    name: 'NextChat',
    category: 'client',
    descriptionKey:
      'Set a custom endpoint and key in the settings panel; model IDs are read from the API.',
  },
  {
    id: 'cherry-studio',
    name: 'Cherry Studio',
    category: 'client',
    descriptionKey:
      'Add a provider with the Astramux base URL, then fetch the live model list.',
  },
  {
    id: 'langchain',
    name: 'LangChain',
    category: 'framework',
    descriptionKey:
      'Use ChatOpenAI with baseURL set to Astramux; chains, tools and streaming keep working.',
  },
  {
    id: 'llamaindex',
    name: 'LlamaIndex',
    category: 'framework',
    descriptionKey:
      'Configure the OpenAI-compatible LLM with the Astramux endpoint for indexing and query engines.',
  },
]

function CategoryIcon(props: { category: IntegrationCategory }) {
  const className = 'size-4'
  switch (props.category) {
    case 'sdk':
      return <Terminal className={className} strokeWidth={1.75} />
    case 'agent':
      return <Bot className={className} strokeWidth={1.75} />
    case 'client':
      return <MonitorSmartphone className={className} strokeWidth={1.75} />
    default:
      return <Workflow className={className} strokeWidth={1.75} />
  }
}

export function IntegrationsPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<IntegrationCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return INTEGRATIONS.filter((item) => {
      if (category !== 'all' && item.category !== category) return false
      if (!needle) return true
      return (
        item.name.toLowerCase().includes(needle) ||
        t(item.descriptionKey).toLowerCase().includes(needle)
      )
    })
  }, [category, query, t])

  const steps = [
    t('Set the base URL to https://astramux.com/v1'),
    t('Paste an API key created in the console'),
    t('Choose a live model ID and send your first request'),
  ]

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-6xl px-5 pt-24 pb-16 sm:px-6 lg:pt-28'>
        <span className='border-border text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium'>
          {t('Integrations')}
        </span>
        <h1 className='mt-5 max-w-3xl text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl'>
          {t('Connect the tools you already use.')}
        </h1>
        <p className='text-muted-foreground mt-4 max-w-2xl text-[15px] leading-relaxed'>
          {t(
            'Astramux speaks the OpenAI schema, so most SDKs, coding agents and desktop clients only need a new base URL. Pick a tool for the exact steps.'
          )}
        </p>

        <div className='mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='border-border bg-card flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 sm:max-w-xs'>
            <Search className='text-muted-foreground size-4 shrink-0' />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search integrations')}
              aria-label={t('Search integrations')}
              className='h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
            />
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type='button'
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
                className={cn(
                  'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                  category === item.id
                    ? 'border-transparent bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className='text-muted-foreground mt-12 text-center text-sm'>
            {t('No integrations match this search.')}
          </p>
        ) : (
          <div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {filtered.map((item) => (
              <article
                key={item.id}
                className='border-border bg-card flex min-w-0 flex-col rounded-xl border p-5'
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='border-border text-foreground/80 inline-flex size-8 items-center justify-center rounded-lg border'>
                    <CategoryIcon category={item.category} />
                  </span>
                  <span className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>
                    {t(
                      CATEGORIES.find((entry) => entry.id === item.category)
                        ?.labelKey ?? 'SDKs'
                    )}
                  </span>
                </div>
                <h2 className='mt-4 text-sm font-semibold'>{item.name}</h2>
                <p className='text-muted-foreground mt-1.5 text-[13px] leading-relaxed'>
                  {t(item.descriptionKey)}
                </p>

                <div className='border-border bg-muted/30 mt-4 min-w-0 rounded-lg border px-2.5 py-2'>
                  <p className='text-muted-foreground text-[10px] font-semibold tracking-wide uppercase'>
                    {t('Base URL')}
                  </p>
                  <code
                    dir='ltr'
                    className='mt-0.5 block overflow-x-auto font-mono text-[11.5px] whitespace-nowrap'
                  >
                    {ASTRAMUX_BASE_URL}
                  </code>
                </div>

                <ol className='mt-4 space-y-1.5'>
                  {steps.map((step, index) => (
                    <li
                      key={step}
                      className='text-muted-foreground flex gap-2 text-[12.5px] leading-relaxed'
                    >
                      <span className='border-border text-foreground/70 inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold'>
                        {index + 1}
                      </span>
                      <span className='min-w-0'>{step}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}

        <div className='border-border bg-card mt-10 flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='text-sm font-semibold'>
              {t('Need a different client?')}
            </p>
            <p className='text-muted-foreground mt-1 text-[13px]'>
              {t(
                'Any tool that accepts an OpenAI-compatible endpoint works with the same base URL and key.'
              )}
            </p>
          </div>
          <a
            href='/docs/openai-compatible'
            className='bg-foreground text-background inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-opacity hover:opacity-90'
          >
            {t('Read the API reference')}
          </a>
        </div>
      </div>
    </PublicLayout>
  )
}
