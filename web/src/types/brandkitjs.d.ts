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

/**
 * `brandkitjs@1.0.6` ships no declaration file even though its package.json
 * points `types` at `dist/index.d.ts`, so this ambient module keeps `tsc -b`
 * honest. Only the named icon exports this project uses are declared.
 *
 * Every icon renders a fixed-size SVG with `fill` defaulting to the brand
 * colour and ignores `className`, so callers should wrap it (see
 * `shared/components/contact/brand-icons.tsx`).
 */
declare module 'brandkitjs' {
  import type { ComponentType } from 'react'

  export type BrandkitIconProps = {
    /** SVG width/height. Accepts pixels or any CSS length, e.g. `100%`. */
    size?: number | string
    /** SVG fill; defaults to the official brand colour. */
    color?: string
  }

  export type BrandkitIcon = ComponentType<BrandkitIconProps>

  export type BrandkitIconMeta = {
    id: string
    name: string
    category: string
    color: string
    svg: string
  }

  export const Discord: BrandkitIcon
  export const Telegram: BrandkitIcon
  export const WhatsApp: BrandkitIcon
  export const Github: BrandkitIcon
  export const Twitter: BrandkitIcon
  export const YouTube: BrandkitIcon
  export const Facebook: BrandkitIcon
  export const Instagram: BrandkitIcon
  export const LinkedIn: BrandkitIcon
  export const Reddit: BrandkitIcon
  export const TikTok: BrandkitIcon
  export const Medium: BrandkitIcon
  export const Pinterest: BrandkitIcon
  export const Snapchat: BrandkitIcon
  export const Spotify: BrandkitIcon
  export const Twitch: BrandkitIcon
  export const Slack: BrandkitIcon
  export const Google: BrandkitIcon

  export function getAllIcons(): BrandkitIconMeta[]
  export function getIconsByCategory(category: string): BrandkitIconMeta[]
  export function searchIcons(query: string): BrandkitIconMeta[]
}
