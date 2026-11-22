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
import { Braces, KeyRound, Receipt, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DocsCallout,
  DocsCard,
  DocsCodeBlock,
  DocsList,
  DocsParagraph,
  DocsSectionTitle,
} from '../components'

function EndpointRow(props: { method: string; path: string; note: string }) {
  return (
    <div className='border-border flex flex-col gap-1 border-b py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3'>
      <span className='text-muted-foreground w-12 shrink-0 font-mono text-[11px]'>
        {props.method}
      </span>
      <code dir='ltr' className='min-w-0 font-mono text-[12.5px] font-medium'>
        {props.path}
      </code>
      <span className='text-muted-foreground text-[12.5px] sm:ms-auto sm:text-end'>
        {props.note}
      </span>
    </div>
  )
}

export function OpenAiCompatiblePage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('OpenAI-compatible')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'These endpoints follow the OpenAI wire format. Any OpenAI SDK can call them by changing only the base URL and the key.'
        )}
      </p>

      <DocsSectionTitle>{t('Endpoints')}</DocsSectionTitle>
      <div className='border-border mt-2 rounded-xl border px-4 py-1'>
        <EndpointRow
          method='POST'
          path='/v1/chat/completions'
          note={t('Chat and tool-calling completions')}
        />
        <EndpointRow
          method='GET'
          path='/v1/models'
          note={t('List models available to the key')}
        />
        <EndpointRow
          method='POST'
          path='/v1/embeddings'
          note={t('Vector embeddings')}
        />
      </div>

      <DocsSectionTitle>{t('Chat completions')}</DocsSectionTitle>
      <DocsCodeBlock
        label='json'
        code={`{
  "model": "gpt-4.1-mini",
  "messages": [{ "role": "user", "content": "Summarize this changelog" }],
  "temperature": 0.2,
  "stream": false
}`}
      />
      <div className='mt-3'>
        <DocsParagraph>
          {t(
            'Optional scalar parameters are forwarded only when you send them, so explicit zeros and false values reach the upstream unchanged.'
          )}
        </DocsParagraph>
      </div>

      <DocsSectionTitle>{t('Streaming')}</DocsSectionTitle>
      <DocsParagraph>
        {t(
          'With stream: true the response is text/event-stream. Read data: lines until [DONE]. Usage arrives in the final chunk when the upstream reports it.'
        )}
      </DocsParagraph>
      <div className='mt-3'>
        <DocsCodeBlock
          label='sse'
          code={`data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" there"}}]}
data: {"usage":{"prompt_tokens":12,"completion_tokens":2}}
data: [DONE]`}
        />
      </div>

      <div className='mt-5'>
        <DocsCallout title={t('Retry before the first token')}>
          {t(
            'A stream that fails after output has started is not restarted. The error arrives in the stream so your client can decide what to do.'
          )}
        </DocsCallout>
      </div>
    </div>
  )
}

export function ProviderNativePage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Provider-native APIs')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Keep the request format your provider already uses. Astramux accepts native Anthropic and Gemini payloads and routes them to the appropriate upstream.'
        )}
      </p>

      <DocsSectionTitle>{t('Anthropic messages')}</DocsSectionTitle>
      <DocsCodeBlock
        label='bash'
        code={`curl https://astramux.com/v1/messages \\
  -H "x-api-key: $ASTRAMUX_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 512,
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`}
      />
      <div className='mt-3'>
        <DocsParagraph>
          {t(
            'Send the key as x-api-key, exactly as the Anthropic SDK does. Streaming, tools and system prompts keep their native shape.'
          )}
        </DocsParagraph>
      </div>

      <DocsSectionTitle>{t('Gemini generateContent')}</DocsSectionTitle>
      <DocsCodeBlock
        label='bash'
        code={`curl "https://astramux.com/v1beta/models/gemini-2.5-pro:generateContent" \\
  -H "x-goog-api-key: $ASTRAMUX_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{ "parts": [{ "text": "Hello" }] }]
  }'`}
      />
      <div className='mt-3'>
        <DocsParagraph>
          {t(
            'Gemini paths keep their version prefix and action suffix. Both the key header and the query parameter form are accepted.'
          )}
        </DocsParagraph>
      </div>

      <div className='mt-6 grid gap-3 sm:grid-cols-2'>
        <DocsCard icon={<Share2 />} title={t('Same routing, any schema')}>
          {t(
            'Provider-native calls use the same health checks, budgets and logs as OpenAI-compatible ones.'
          )}
        </DocsCard>
        <DocsCard
          icon={<Braces />}
          title={t('No translation layer to maintain')}
        >
          {t(
            'Existing Anthropic and Gemini clients keep working without a proxy you have to host.'
          )}
        </DocsCard>
      </div>
    </div>
  )
}

export function BillingAndKeysPage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Billing & Keys')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Astramux bills pay-as-you-go against the account balance. Every request records its token usage, the model and the upstream that served it.'
        )}
      </p>

      <DocsSectionTitle>{t('How usage becomes a charge')}</DocsSectionTitle>
      <DocsList
        items={[
          t(
            'Prompt and completion tokens are priced per model from the live price table.'
          ),
          t(
            'The charge is deducted from the account balance at the end of the request.'
          ),
          t(
            'Each call appears in Usage Logs with latency, status and the upstream route.'
          ),
          t('A failed request that produced no tokens is not charged.'),
        ]}
      />

      <DocsSectionTitle>{t('Workflow')}</DocsSectionTitle>
      <div className='mt-3 grid gap-3 sm:grid-cols-3'>
        <DocsCard
          icon={<KeyRound />}
          title={t('Create a key')}
          href='/app/keys'
          linkLabel={t('API Keys')}
        >
          {t('Give each service its own key and budget.')}
        </DocsCard>
        <DocsCard
          icon={<Receipt />}
          title={t('Top up the balance')}
          href='/app/wallet'
          linkLabel={t('Wallet')}
        >
          {t(
            'Add credit before a large run so requests are never rejected for balance.'
          )}
        </DocsCard>
        <DocsCard
          icon={<Braces />}
          title={t('Review usage')}
          href='/app/usage-logs/common'
          linkLabel={t('Usage Logs')}
        >
          {t('Filter by key or model to attribute spend.')}
        </DocsCard>
      </div>

      <DocsSectionTitle>{t('Balance rules')}</DocsSectionTitle>
      <DocsList
        items={[
          t(
            'Requests are rejected with 402 when the balance cannot cover the pre-authorized amount.'
          ),
          t(
            'Key budgets are checked before the account balance, so a capped key fails first.'
          ),
          t(
            'Prices update live; the price at request time is the price you are charged.'
          ),
        ]}
      />

      <p className='text-muted-foreground mt-5 text-[13px]'>
        <Link to='/pricing' className='underline'>
          {t('See current model prices')}
        </Link>
      </p>
    </div>
  )
}

const ERROR_ROWS = [
  { code: '400', key: 'Invalid request', retry: 'No' },
  { code: '401', key: 'Missing or invalid key', retry: 'No' },
  { code: '402', key: 'Insufficient balance', retry: 'No' },
  { code: '403', key: 'Model not permitted for this key', retry: 'No' },
  { code: '404', key: 'Unknown model or endpoint', retry: 'No' },
  { code: '429', key: 'Rate limit reached', retry: 'Yes, with backoff' },
  { code: '500', key: 'Upstream failure', retry: 'Yes' },
  { code: '503', key: 'No healthy upstream', retry: 'Yes, with backoff' },
]

const BACKOFF_SNIPPET = `import time

def call_with_retry(fn, attempts=4):
    for attempt in range(attempts):
        try:
            return fn()
        except RateLimited as error:
            if attempt == attempts - 1:
                raise
            time.sleep(min(2 ** attempt, 8) + error.jitter)`

export function ErrorsAndRetriesPage() {
  const { t } = useTranslation()

  return (
    <div className='min-w-0'>
      <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Errors & Retries')}
      </h1>
      <p className='text-muted-foreground mt-3 max-w-2xl text-[14px] leading-relaxed'>
        {t(
          'Errors follow the OpenAI error envelope: a status code and a JSON body with error.message, error.type and error.code.'
        )}
      </p>

      <DocsSectionTitle>{t('Status codes')}</DocsSectionTitle>
      <div className='border-border mt-2 overflow-hidden rounded-xl border'>
        <div className='text-muted-foreground bg-muted/40 grid grid-cols-[56px_minmax(0,1fr)] gap-3 px-4 py-2 text-[11px] font-semibold tracking-wide uppercase sm:grid-cols-[56px_minmax(0,1fr)_140px]'>
          <span>{t('Code')}</span>
          <span>{t('Meaning')}</span>
          <span className='hidden sm:block'>{t('Retry')}</span>
        </div>
        {ERROR_ROWS.map((row) => (
          <div
            key={row.code}
            className='border-border grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t px-4 py-2.5 text-[13px] sm:grid-cols-[56px_minmax(0,1fr)_140px]'
          >
            <span className='font-mono text-[12px]'>{row.code}</span>
            <span className='min-w-0'>{t(row.key)}</span>
            <span className='text-muted-foreground hidden text-[12px] sm:block'>
              {t(row.retry)}
            </span>
          </div>
        ))}
      </div>

      <DocsSectionTitle>{t('Backoff')}</DocsSectionTitle>
      <DocsParagraph>
        {t(
          'Retry only 429, 500 and 503, and only with exponential backoff and jitter. Never retry a 400, 401, 402, 403 or 404 unchanged.'
        )}
      </DocsParagraph>
      <div className='mt-3'>
        <DocsCodeBlock label='python' code={BACKOFF_SNIPPET} />
      </div>

      <div className='mt-5'>
        <DocsCallout title={t('Idempotency')} tone='warning'>
          {t(
            'A retried stream may duplicate output if the first attempt already produced tokens. Track what you have received and resume from there.'
          )}
        </DocsCallout>
      </div>

      <DocsSectionTitle>{t('Reading an error')}</DocsSectionTitle>
      <DocsCodeBlock
        label='json'
        code={`{
  "error": {
    "message": "No healthy upstream is available for this model.",
    "type": "upstream_unavailable",
    "code": "no_healthy_upstream"
  }
}`}
      />
    </div>
  )
}
