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
import { useEffect, useState } from 'react'
import { Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/shared/components/ui/chart'
import {
  formatCompactNumber,
  formatCompactQuota,
} from '@/shared/lib/format'

import { useChartLocale } from '../hooks/use-chart-locale'

/**
 * Category axis that reads in the interface direction: a right-to-left page
 * plots time from right to left and anchors the value axis on the right.
 */
export function AnalyticsXAxis(props: {
  dataKey: string
  minTickGap?: number
}) {
  const { isRtl } = useChartLocale()

  return (
    <XAxis
      dataKey={props.dataKey}
      reversed={isRtl}
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      height={22}
      interval='preserveStartEnd'
      minTickGap={props.minTickGap ?? 24}
    />
  )
}

/** Value axis with compact tick labels ('1.2K', '$3.4M') in the active locale. */
export function AnalyticsYAxis(props: {
  kind: 'count' | 'money'
  width?: number
}) {
  const { isRtl, locale } = useChartLocale()
  const formatTick =
    props.kind === 'money'
      ? (value: number) => formatCompactQuota(value, locale)
      : (value: number) => formatCompactNumber(value, locale)

  return (
    <YAxis
      orientation={isRtl ? 'right' : 'left'}
      tickLine={false}
      axisLine={false}
      width={props.width ?? (props.kind === 'money' ? 56 : 40)}
      tickCount={4}
      allowDecimals={false}
      tickFormatter={(value) => formatTick(Number(value))}
    />
  )
}

type TooltipContentProps = Parameters<typeof ChartTooltipContent>[0]

/**
 * A pointer that slides across a chart repaints the tooltip on every frame.
 * Holding the payload for a short, restarting window renders only the position
 * where the finger or cursor settles, which keeps touch scrolling smooth.
 */
function DebouncedTooltipContent(props: TooltipContentProps) {
  const [shown, setShown] = useState<TooltipContentProps>(props)

  useEffect(() => {
    if (!props.active) return
    const timer = window.setTimeout(() => setShown(props), 70)
    return () => window.clearTimeout(timer)
  }, [props])

  // The stored payload can outlive the pointer, so the live `active` flag is
  // always the one that decides whether the tooltip is visible.
  return <ChartTooltipContent {...shown} active={props.active} />
}

/**
 * Tooltip with the debounced mobile-friendly content above. Chart animations
 * are off, so the 5s live refresh cannot replay an entrance animation.
 */
export function AnalyticsTooltip(props: {
  formatter?: (value: number) => string
  hideLabel?: boolean
}) {
  return (
    <Tooltip
      isAnimationActive={false}
      cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
      content={
        <DebouncedTooltipContent
          formatter={
            props.formatter
              ? (value) => props.formatter?.(Number(value))
              : undefined
          }
          hideLabel={props.hideLabel}
        />
      }
    />
  )
}
