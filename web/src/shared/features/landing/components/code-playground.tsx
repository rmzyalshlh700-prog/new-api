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

For commercial licensing, please contact contact@quantumnous.com
*/
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/shared/lib/lobe-icon'
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard'
import { cn } from '@/shared/lib/utils'

import { LANDING_PROVIDERS } from '../providers'

const TONES = {
  kw: 'text-violet-600 dark:text-violet-300',
  fn: 'text-sky-600 dark:text-sky-300',
  str: 'text-emerald-600 dark:text-emerald-300',
  num: 'text-blue-600 dark:text-blue-300',
  key: 'text-indigo-600 dark:text-indigo-300',
  punct: 'text-muted-foreground',
  plain: 'text-foreground',
} as const

const TABS = LANDING_PROVIDERS

function buildSnippet(model: string) {
  return `import os
from openai import OpenAI

client = OpenAI(
    base_url="https://astramux.com/v1",
    api_key=os.environ[
        "ASTRAMUX_API_KEY"
    ],
)

stream = client.chat.completions.create(
    model="${model}",
    messages=[
        {"role": "user",
         "content": "Hello"},
    ],
    stream=True,
)`
}

export function CodePlayground() {
  const { t } = useTranslation()
  const [providerId, setProviderId] = useState(TABS[0].id)
  const provider = TABS.find((item) => item.id === providerId) ?? TABS[0]
  const snippet = buildSnippet(provider.model)
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const copied = copiedText === snippet

  return (
    <div className='rounded-3xl border border-border bg-card text-card-foreground p-2.5 shadow-[0_40px_90px_-60px_rgba(15,23,42,0.8)] sm:p-3'>
      <div
        role='tablist'
        aria-label={t('landing.code.providersLabel')}
        className='flex flex-wrap items-center gap-1 px-1 pb-2.5'
      >
        {TABS.map((tab) => {
          const active = tab.id === provider.id
          return (
            <button
              key={tab.id}
              type='button'
              role='tab'
              aria-selected={active}
              onClick={() => setProviderId(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-medium transition-all duration-200',
                active
                  ? 'border-primary/70 bg-background text-foreground shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-background hover:text-foreground/80'
              )}
            >
              <span className='flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground'>
                {tab.monoOnly ? (
                  getLobeIcon(tab.mono, 16)
                ) : (
                  <>
                    <span className='flex dark:hidden'>
                      {getLobeIcon(tab.icon, 16)}
                    </span>
                    <span className='hidden dark:flex'>
                      {getLobeIcon(tab.mono, 16)}
                    </span>
                  </>
                )}
              </span>
              <span>{tab.name}</span>
            </button>
          )
        })}
      </div>

      <div
        dir='ltr'
        className='overflow-hidden rounded-2xl border border-border bg-muted/50 text-foreground'
      >
        <div className='flex items-center gap-2.5 border-b border-border px-3.5 py-2.5'>
          <div className='flex items-center gap-1.5' aria-hidden='true'>
            <span className='size-2.5 rounded-full bg-[#FF5F57]/80' />
            <span className='size-2.5 rounded-full bg-[#FEBC2E]/80' />
            <span className='size-2.5 rounded-full bg-[#28C840]/80' />
          </div>
          <span className='landing-code text-[11px] text-muted-foreground'>
            quickstart.py
          </span>
          <span className='landing-code ms-auto hidden truncate text-[10px] text-muted-foreground sm:inline'>
            POST /v1/chat/completions
          </span>
          <button
            type='button'
            onClick={() => copyToClipboard(snippet)}
            aria-label={t(
              copied ? 'landing.code.copied' : 'landing.code.copy'
            )}
            className='ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:ms-2'
          >
            {copied ? (
              <Check className='size-3.5 text-emerald-600 dark:text-emerald-400' aria-hidden='true' />
            ) : (
              <Copy className='size-3.5' aria-hidden='true' />
            )}
            {t(copied ? 'landing.code.copied' : 'landing.code.copy')}
          </button>
        </div>

        <pre
          dir='ltr'
          className='landing-code overflow-x-auto p-4 text-[11.5px] leading-6 break-words whitespace-pre-wrap sm:p-5 sm:text-[12.5px]'
        >
          <code dir='ltr'>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.kw}>import</span>
              <span className={TONES.plain}>{' os'}</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.kw}>from</span>
              <span className={TONES.plain}>{' openai '}</span>
              <span className={TONES.kw}>import</span>
              <span className={TONES.plain}>{' '}</span>
              <span className={TONES.fn}>OpenAI</span>
            </span>
            <span className='block whitespace-pre-wrap'>{' '}</span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>client</span>
              <span className={TONES.punct}>{' = '}</span>
              <span className={TONES.fn}>OpenAI</span>
              <span className={TONES.punct}>(</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'    base_url'}</span>
              <span className={TONES.punct}>=</span>
              <span className={TONES.str}>
                &quot;https://astramux.com/v1&quot;
              </span>
              <span className={TONES.punct}>,</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'    api_key=os.environ['}</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'        '}</span>
              <span className={TONES.str}>&quot;ASTRAMUX_API_KEY&quot;</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'    ],'}</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.punct}>)</span>
            </span>
            <span className='block whitespace-pre-wrap'>{' '}</span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>stream</span>
              <span className={TONES.punct}>{' = '}</span>
              <span className={TONES.plain}>client.chat.completions.</span>
              <span className={TONES.fn}>create</span>
              <span className={TONES.punct}>(</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'    model'}</span>
              <span className={TONES.punct}>=</span>
              <span className={TONES.str}>{`"${provider.model}"`}</span>
              <span className={TONES.punct}>,</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'    messages=['}</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'        '}</span>
              <span className={TONES.punct}>{'{'}</span>
              <span className={TONES.key}>&quot;role&quot;</span>
              <span className={TONES.punct}>{': '}</span>
              <span className={TONES.str}>&quot;user&quot;</span>
              <span className={TONES.punct}>,</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'         '}</span>
              <span className={TONES.key}>&quot;content&quot;</span>
              <span className={TONES.punct}>{': '}</span>
              <span className={TONES.str}>&quot;Hello&quot;</span>
              <span className={TONES.punct}>{'},'}</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'    ],'}</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.plain}>{'    stream'}</span>
              <span className={TONES.punct}>=</span>
              <span className={TONES.num}>True</span>
              <span className={TONES.punct}>,</span>
            </span>
            <span className='block whitespace-pre-wrap'>
              <span className={TONES.punct}>)</span>
            </span>
          </code>
        </pre>
      </div>
    </div>
  )
}
