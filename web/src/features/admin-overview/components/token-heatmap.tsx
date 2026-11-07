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
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import dayjs from '@/lib/dayjs'
import {
  formatCompactNumber,
  formatInteger,
  formatLogQuota,
} from '@/lib/format'

import type { DailyActivityPoint } from '../types'

const LEVEL_SHARES = [0, 25, 50, 75, 100] as const

export interface TokenHeatmapProps {
  points: DailyActivityPoint[]
  loading?: boolean
  className?: string
}

/**
 * Contribution-style activity grid: one column per week, one row per weekday,
 * coloured by the day's token volume with a square-root ramp so two busy days
 * stay distinguishable. Days outside the window are simply absent.
 */
export function TokenHeatmap(props: TokenHeatmapProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='mt-3 flex gap-[3px]'>
        {Array.from({ length: 12 }, (_, week) => (
          <div key={week} className='flex flex-col gap-[3px]'>
            {Array.from({ length: 7 }, (_, day) => (
              <div
                key={day}
                className='bg-muted size-3 rounded-[3px]'
                aria-hidden='true'
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const measured = props.points.filter((point) => point.tokens > 0)
  if (props.points.length === 0 || measured.length === 0) {
    return (
      <div className='text-muted-foreground mt-3 flex h-24 items-center justify-center text-sm'>
        {t('No data available')}
      </div>
    )
  }

  const maxTokens = measured.reduce(
    (max, point) => Math.max(max, point.tokens),
    0
  )
  const totalTokens = measured.reduce((sum, point) => sum + point.tokens, 0)
  const totalRequests = measured.reduce((sum, point) => sum + point.requests, 0)
  const maxShare = Math.sqrt(maxTokens)

  // Pad the first week so every column starts on the same weekday. Each cell
  // carries a stable key: the day it shows, or its position for padding.
  const firstWeekday = dayjs(props.points[0].day).day()
  const cells: Array<{ key: string; point: DailyActivityPoint | null }> = [
    ...Array.from({ length: firstWeekday }, (_, offset) => ({
      key: `pad-${offset}`,
      point: null,
    })),
    ...props.points.map((point) => ({ key: point.day, point })),
  ]
  const weeks: Array<Array<{ key: string; point: DailyActivityPoint | null }>> =
    []
  for (let offset = 0; offset < cells.length; offset += 7) {
    weeks.push(cells.slice(offset, offset + 7))
  }

  const levelFor = (tokens: number): number => {
    if (tokens <= 0) return 0
    const share = Math.sqrt(tokens) / maxShare
    if (share <= 0.25) return 1
    if (share <= 0.5) return 2
    if (share <= 0.75) return 3
    return 4
  }

  return (
    <div className='mt-3'>
      <TooltipProvider delay={100}>
        <div
          className='flex gap-[3px] overflow-x-auto pb-1'
          role='img'
          aria-label={t('Token activity')}
        >
          {weeks.map((week) => (
            <div key={week[0].key} className='flex flex-col gap-[3px]'>
              {week.map((cell) => {
                if (!cell.point) {
                  return (
                    <div
                      key={cell.key}
                      className='size-3 rounded-[3px] opacity-0'
                      aria-hidden='true'
                    />
                  )
                }
                const point = cell.point
                const level = levelFor(point.tokens)
                return (
                  <Tooltip key={cell.key}>
                    <TooltipTrigger
                      render={
                        <button
                          type='button'
                          className='size-3 shrink-0 rounded-[3px] transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1'
                          style={{
                            background:
                              level === 0
                                ? 'var(--muted)'
                                : `color-mix(in oklch, var(--chart-2) ${LEVEL_SHARES[level]}%, var(--muted))`,
                          }}
                          aria-label={`${point.day}: ${formatInteger(point.tokens)} ${t('Tokens')}`}
                        />
                      }
                    />
                    <TooltipContent className='min-w-40'>
                      <div className='text-xs'>
                        <div className='font-semibold'>
                          {dayjs(point.day).format('YYYY-MM-DD ddd')}
                        </div>
                        <div className='mt-1 flex justify-between gap-4'>
                          <span>{t('Tokens')}</span>
                          <span className='tabular-nums'>
                            {formatCompactNumber(point.tokens)}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>{t('Requests')}</span>
                          <span className='tabular-nums'>
                            {formatInteger(point.requests)}
                          </span>
                        </div>
                        <div className='flex justify-between gap-4'>
                          <span>{t('Consumption')}</span>
                          <span className='tabular-nums'>
                            {formatLogQuota(point.quota)}
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </div>
      </TooltipProvider>
      <div className='text-muted-foreground mt-2 flex items-center justify-between gap-3 text-[11px]'>
        <span>
          {t('{{count}} days of activity', { count: measured.length })} ·{' '}
          {formatCompactNumber(totalTokens)} {t('Tokens')} ·{' '}
          {formatInteger(totalRequests)} {t('Requests')}
        </span>
        <span className='inline-flex items-center gap-1.5'>
          {t('Less')}
          <span className='inline-flex gap-[3px]' aria-hidden='true'>
            {LEVEL_SHARES.map((share) => (
              <span
                key={share}
                className='size-2.5 rounded-[2px]'
                style={{
                  background:
                    share === 0
                      ? 'var(--muted)'
                      : `color-mix(in oklch, var(--chart-2) ${share}%, var(--muted))`,
                }}
              />
            ))}
          </span>
          {t('More')}
        </span>
      </div>
    </div>
  )
}
