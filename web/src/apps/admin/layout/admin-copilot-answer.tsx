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
import { Markdown, type AssistantMessageProps } from '@copilotkit/react-ui'
import {
  CircleDashed,
  Copy,
  OctagonAlert,
  Sparkles,
  Table2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { copyToClipboard } from '@/shared/lib/copy-to-clipboard'
import {
  aiResponseMeta,
  formatAiAnswer,
  type AiResponseMeta,
} from '@/shared/lib/ai-formatter'
import { cn } from '@/shared/lib/utils'

/**
 * The console's wrapper around an assistant answer.
 *
 * The assistant is instructed to answer in the house style (see
 * `@/shared/lib/ai-formatter`), and this component is where that style becomes
 * visible: a small header names the kind of answer with a lucide icon, and the
 * body is normalised before it is rendered, so a reply that ignored the
 * instruction still reads like the rest of the console.
 */
const RESPONSE_ICONS: Record<AiResponseMeta['icon'], LucideIcon> = {
  sparkles: Sparkles,
  table: Table2,
  'alert-triangle': TriangleAlert,
  'octagon-alert': OctagonAlert,
  'circle-dashed': CircleDashed,
}

const SEVERITY_CLASSES: Record<AiResponseMeta['severity'], string> = {
  info: 'text-muted-foreground',
  warning: 'text-amber-600 dark:text-amber-500',
  error: 'text-destructive',
}

/** Renders one assistant answer with its type marker. */
export function AdminCopilotAnswer({ content }: { content: string }) {
  const { t } = useTranslation()
  // Both are pure string work on a short reply; memoising them would cost more
  // than it saves and defeats the compiler's own caching.
  const formatted = formatAiAnswer(content)
  const meta = aiResponseMeta(content)
  const Icon = RESPONSE_ICONS[meta.icon]

  if (formatted === '') return null

  return (
    <div className='flex flex-col gap-1.5'>
      <div
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase',
          SEVERITY_CLASSES[meta.severity]
        )}
      >
        <Icon className='size-3.5 shrink-0' aria-hidden='true' />
        <span>{t(meta.labelKey)}</span>
      </div>
      <Markdown content={formatted} />
    </div>
  )
}

/**
 * Replaces CopilotKit's default assistant bubble so every answer goes through
 * the formatter, and keeps a copy control of its own because the default one
 * lives in the component this replaces.
 */
export function AdminCopilotAssistantMessage({
  message,
  isGenerating,
}: AssistantMessageProps) {
  const { t } = useTranslation()
  const raw = typeof message?.content === 'string' ? message.content : ''
  // While the answer streams, formatting it on every token would rewrite the
  // ruler of a half-written table; the finished form is applied at the end.
  const content = isGenerating ? raw : formatAiAnswer(raw)

  return (
    <div className='group/answer flex flex-col gap-1' data-testid='copilot-answer'>
      <AdminCopilotAnswer content={content} />
      {content !== '' && (
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-[11px] opacity-0 transition-opacity group-hover/answer:opacity-100 focus-visible:opacity-100'
          onClick={async () => {
            const copied = await copyToClipboard(content)
            if (copied) toast.success(t('Copied!'))
          }}
        >
          <Copy className='size-3' aria-hidden='true' />
          {t('Copy')}
        </button>
      )}
    </div>
  )
}
