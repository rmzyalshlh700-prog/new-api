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
import { useId, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'

export interface SparklinePoint {
  label: string
  value: number
  /** Exact value behind the visible one, when the axis is abbreviated. */
  exact?: string
}

export interface TileSparklineProps {
  points: SparklinePoint[]
  height?: number
  /** CSS color of the line and gradient fill. */
  color: string
  /** Accessible description announced instead of the decorative marks. */
  ariaLabel: string
  className?: string
}

/**
 * Minimal area sparkline for the KPI tiles: a smooth gradient area with a
 * hover crosshair, rendered as plain SVG so four tiles stay cheap to draw.
 * Flat series (fewer than two points) render an empty slot.
 */
export function TileSparkline(props: TileSparklineProps) {
  const height = props.height ?? 56
  const gradientId = useId()
  const [hovered, setHovered] = useState<number | null>(null)

  const geometry = useMemo(() => {
    const values = props.points.map((point) => Math.max(0, point.value))
    if (values.length < 2) return null
    const width = 100
    const pad = 3
    const max = Math.max(...values)
    const span = max > 0 ? max : 1
    const step = width / (values.length - 1)
    const coords = values.map((value, index) => ({
      x: index * step,
      y: pad + (1 - value / span) * (height - pad * 2),
    }))
    const line = buildSmoothPath(coords)
    return {
      line,
      area: `${line} L ${width} ${height} L 0 ${height} Z`,
      coords,
      width,
    }
  }, [props.points, height])

  if (!geometry) {
    return (
      <div
        style={{ height }}
        className={cn('w-full', props.className)}
        aria-hidden='true'
      />
    )
  }

  const active = hovered != null ? geometry.coords[hovered] : null
  const activePoint = hovered != null ? props.points[hovered] : null

  return (
    <div
      className={cn('relative w-full', props.className)}
      style={{ height }}
      role='img'
      aria-label={props.ariaLabel}
      onMouseLeave={() => setHovered(null)}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const ratio = (event.clientX - rect.left) / rect.width
        const index = Math.round(ratio * (geometry.coords.length - 1))
        setHovered(Math.min(Math.max(index, 0), geometry.coords.length - 1))
      }}
    >
      <svg
        viewBox={`0 0 ${geometry.width} ${height}`}
        preserveAspectRatio='none'
        className='h-full w-full overflow-visible'
        aria-hidden='true'
      >
        <defs>
          <linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={props.color} stopOpacity={0.28} />
            <stop offset='100%' stopColor={props.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={geometry.area} fill={`url(#${gradientId})`} />
        <path
          d={geometry.line}
          fill='none'
          stroke={props.color}
          strokeWidth={1.5}
          strokeLinecap='round'
          strokeLinejoin='round'
          vectorEffect='non-scaling-stroke'
        />
        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={0}
            y2={height}
            stroke={props.color}
            strokeOpacity={0.35}
            strokeDasharray='2 2'
            vectorEffect='non-scaling-stroke'
          />
        )}
      </svg>
      {active && activePoint && (
        <div
          className='bg-popover text-popover-foreground pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border px-2 py-1 font-mono text-[11px] whitespace-nowrap tabular-nums shadow-md'
          style={{
            left: `${(active.x / geometry.width) * 100}%`,
            top: Math.max(0, active.y - 34),
          }}
        >
          <span className='text-muted-foreground'>{activePoint.label}</span>{' '}
          <span className='font-semibold'>
            {activePoint.exact ?? activePoint.value}
          </span>
        </div>
      )}
    </div>
  )
}

type Coord = { x: number; y: number }

/**
 * Catmull-Rom style smoothing: each segment becomes a cubic bezier whose
 * control points carry the neighbours' slope, the same visual as the smooth
 * monotone lines the main charts draw.
 */
function buildSmoothPath(coords: readonly Coord[]): string {
  if (coords.length < 2) return ''
  const segments: string[] = [`M ${coords[0].x} ${coords[0].y}`]
  for (let index = 0; index < coords.length - 1; index++) {
    const p0 = coords[Math.max(0, index - 1)]
    const p1 = coords[index]
    const p2 = coords[index + 1]
    const p3 = coords[Math.min(coords.length - 1, index + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    segments.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`)
  }
  return segments.join(' ')
}
