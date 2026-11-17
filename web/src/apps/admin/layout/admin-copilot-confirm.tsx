import { Check, ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils'

/**
 * Interactive confirmation for the Copilot's destructive actions.
 *
 * These tools used to ask the operator to type "yes" in the chat, which is both
 * a conversation detour and a weak guard: nothing in the request proved a person
 * had read the details. They are registered as human-in-the-loop actions
 * instead, so the console renders the exact arguments as a card with a green
 * Confirm and a red Cancel, and the API call only happens after Confirm.
 *
 * The card answers the tool call with what actually happened, so the assistant
 * keeps narrating from a real result rather than from an assumption.
 */
type ConfirmPhase = 'inProgress' | 'executing' | 'complete'

export interface AdminCopilotConfirmDetail {
  label: string
  value: string
}

interface AdminCopilotConfirmCardProps {
  title: string
  description: string
  details: AdminCopilotConfirmDetail[]
  status: ConfirmPhase
  result?: unknown
  execute: () => Promise<Record<string, unknown>>
  onRespond: (value: unknown) => void
  onCancel: () => void
}

function describeResult(result: unknown, fallback: string): string {
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    for (const key of ['message', 'error']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim() !== '') return value
    }
  }
  return fallback
}

/** The card an operator clicks, rendered where the tool call would be. */
export function AdminCopilotConfirmCard({
  title,
  description,
  details,
  status,
  result,
  execute,
  onRespond,
  onCancel,
}: AdminCopilotConfirmCardProps) {
  const { t } = useTranslation()
  const [running, setRunning] = useState(false)

  if (status === 'complete') {
    return (
      <div className='border-border/60 bg-muted/40 text-muted-foreground my-1 rounded-lg border px-3 py-2 text-xs'>
        {describeResult(result, t('Done'))}
      </div>
    )
  }

  const ready = status === 'executing' && !running

  return (
    <div
      className='border-border my-2 overflow-hidden rounded-lg border'
      data-testid='copilot-confirm-card'
    >
      <div className='flex items-start gap-2 px-3 py-2.5'>
        <ShieldAlert
          className='mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500'
          aria-hidden='true'
        />
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium'>{title}</p>
          <p className='text-muted-foreground mt-0.5 text-xs'>{description}</p>
          {details.length > 0 && (
            <dl className='mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs'>
              {details.map((detail) => (
                <div key={detail.label} className='contents'>
                  <dt className='text-muted-foreground'>{detail.label}</dt>
                  <dd className='truncate font-medium'>{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <div className='bg-muted/50 flex items-center justify-end gap-2 px-3 py-2'>
        <button
          type='button'
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-white transition-colors',
            'bg-red-600 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600'
          )}
          disabled={running}
          onClick={onCancel}
        >
          <X className='size-3.5' aria-hidden='true' />
          {t('Cancel')}
        </button>
        <button
          type='button'
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-white transition-colors',
            'bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600',
            !ready && 'opacity-60'
          )}
          disabled={!ready}
          onClick={async () => {
            setRunning(true)
            // execute() resolves with the outcome either way, so the assistant
            // hears about a refusal instead of waiting for a call that failed.
            const outcome = await execute()
            setRunning(false)
            onRespond(outcome)
          }}
        >
          <Check className='size-3.5' aria-hidden='true' />
          {running ? t('Working...') : t('Confirm')}
        </button>
      </div>
    </div>
  )
}
