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

import { cn } from '@/shared/lib/utils'

type HealthRingTone = 'ok' | 'warn' | 'err' | 'idle'

const TONE_CLASSES: Record<HealthRingTone, string> = {
  ok: 'text-success',
  warn: 'text-warning',
  err: 'text-destructive',
  idle: 'text-console-ink-3',
}

/** Thresholds are shared with the label so the colour and the wording agree. */
function healthRingTone(score: number | null): HealthRingTone {
  if (score == null) return 'idle'
  if (score >= 99) return 'ok'
  if (score >= 95) return 'warn'
  return 'err'
}

interface HealthRingProps {
  /** Percentage in [0, 100]; `null` renders an empty ring. */
  score: number | null
  /** Short caption under the number, already translated. */
  caption: string
  size?: 'md' | 'lg'
  className?: string
}

/**
 * Circular gauge for a single percentage (success rate, quota headroom).
 *
 * Drawn as an SVG stroke so it stays crisp at any zoom and needs no chart
 * library. The arc starts at twelve o'clock and grows clockwise, which reads
 * the same in left-to-right and right-to-left layouts; only the text is
 * mirrored by the surrounding direction.
 */
export function HealthRing(props: HealthRingProps) {
  const { t } = useTranslation()
  const size = props.size ?? 'lg'
  const box = size === 'lg' ? 132 : 96
  const stroke = size === 'lg' ? 9 : 7
  const radius = (box - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, props.score ?? 0))
  const dash = (clamped / 100) * circumference
  const tone = healthRingTone(props.score)

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        TONE_CLASSES[tone],
        props.className
      )}
      style={{ width: box, height: box }}
      role='img'
      aria-label={
        props.score == null
          ? `${props.caption}: ${t('No data yet')}`
          : `${props.caption}: ${clamped.toFixed(1)}%`
      }
    >
      <svg
        viewBox={`0 0 ${box} ${box}`}
        className='size-full -rotate-90'
        aria-hidden='true'
      >
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill='none'
          strokeWidth={stroke}
          className='stroke-console-track'
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill='none'
          strokeWidth={stroke}
          strokeLinecap='round'
          stroke='currentColor'
          strokeDasharray={`${dash} ${circumference - dash}`}
          className='transition-[stroke-dasharray] duration-500 ease-out'
        />
      </svg>
      <div className='absolute inset-0 flex flex-col items-center justify-center gap-0.5'>
        <span
          className={cn(
            'text-console-ink font-semibold tabular-nums',
            size === 'lg' ? 'text-2xl' : 'text-lg'
          )}
        >
          {props.score == null ? '—' : `${clamped.toFixed(1)}%`}
        </span>
        <span className='text-console-ink-3 max-w-[80%] truncate text-xs font-medium'>
          {props.caption}
        </span>
      </div>
    </div>
  )
}
