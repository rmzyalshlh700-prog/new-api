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
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/components/ui/button'
import {
  attemptChunkReload,
  isChunkLoadError,
} from '@/shared/lib/chunk-load-recovery'
import { cn } from '@/shared/lib/utils'

const FEEDBACK_URL = 'https://github.com/QuantumNous/new-api/issues'

type GeneralErrorProps = React.HTMLAttributes<HTMLDivElement> & {
  minimal?: boolean
  error?: unknown
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const response = (error as Record<string, unknown>).response
  if (typeof response !== 'object' || response === null) return undefined
  const status = (response as Record<string, unknown>).status
  return typeof status === 'number' ? status : undefined
}

export function GeneralError({
  className,
  minimal = false,
  error,
}: GeneralErrorProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { history } = useRouter()
  useEffect(() => {
    // Recover only when the failed route is displayed, never on intent preload.
    // The session flag is shared with the document-level listener so a broken
    // chunk can never trigger two reloads for the same tab.
    if (!isChunkLoadError(error)) return
    attemptChunkReload()
  }, [error])

  const status = getHttpStatus(error)
  const isRateLimited = status === 429
  // The emoticon is pinned left-to-right so it never lands on the wrong side
  // of the sentence in right-to-left locales (F-4); the translated message
  // keeps its existing key, so no locale file changes are needed.
  const title: ReactNode = isRateLimited ? (
    t('Too many requests')
  ) : (
    <span>
      {t('Oops! Something went wrong')} <span dir='ltr'>:')</span>
    </span>
  )
  const description = isRateLimited
    ? t('Please wait a moment before trying again.')
    : t('Please try again later.')

  return (
    <div className={cn('h-svh w-full', className)}>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        {!minimal && status !== undefined && (
          <h1 className='text-[7rem] leading-tight font-bold'>{status}</h1>
        )}
        <span className='font-medium'>{title}</span>
        <p className='text-muted-foreground text-center'>
          {t('We apologize for the inconvenience.')} <br /> {description}
        </p>
        {!minimal && (
          <p className='text-muted-foreground text-center text-sm'>
            {t('If this keeps happening, please report it on GitHub Issues.')}
          </p>
        )}
        {!minimal && (
          <div className='mt-6 flex flex-wrap justify-center gap-4'>
            <Button variant='outline' onClick={() => history.go(-1)}>
              {t('Go Back')}
            </Button>
            <Button
              variant='outline'
              render={
                <a
                  href={FEEDBACK_URL}
                  target='_blank'
                  rel='noopener noreferrer'
                />
              }
            >
              {t('Report an issue')}
            </Button>
            <Button onClick={() => navigate({ to: '/' })}>
              {t('Back to Home')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
