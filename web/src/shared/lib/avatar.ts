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
import type { CSSProperties } from 'react'

export type UserAvatarStyle = Pick<CSSProperties, 'backgroundColor' | 'color'>

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getUserAvatarStyle(name: string): UserAvatarStyle {
  const hash = hashString(name)
  const hue = hash % 360
  const saturation = 54 + (hash % 8)
  const lightness = 52 + ((hash >> 4) % 8)

  // Keep white initials readable on every hue: light backgrounds (yellows,
  // light greens…) pick dark text instead of failing WCAG AA contrast.
  const relativeLuminance = computeHslLuminance(hue, saturation, lightness)
  const textColor = relativeLuminance >= 0.35 ? '#1f2937' : 'white'

  return {
    backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: textColor,
  }
}

/**
 * Relative luminance of an HSL color using the WCAG 2.x formula so avatar
 * fallback initials can be checked for contrast against the background.
 */
function computeHslLuminance(
  hue: number,
  saturation: number,
  lightness: number
): number {
  const s = saturation / 100
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const huePrime = (((hue % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((huePrime % 2) - 1))
  let [r, g, b] = [0, 0, 0]
  if (huePrime < 1) [r, g, b] = [c, x, 0]
  else if (huePrime < 2) [r, g, b] = [x, c, 0]
  else if (huePrime < 3) [r, g, b] = [0, c, x]
  else if (huePrime < 4) [r, g, b] = [0, x, c]
  else if (huePrime < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  const channel = (raw: number) => {
    const v = Math.min(Math.max(raw + m, 0), 1)
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  )
}

export function getUserAvatarFallback(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}
