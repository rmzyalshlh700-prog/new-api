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
import {
  Discord as DiscordGlyph,
  Facebook as FacebookGlyph,
  Github as GithubGlyph,
  Google as GoogleGlyph,
  Instagram as InstagramGlyph,
  LinkedIn as LinkedInGlyph,
  Medium as MediumGlyph,
  Pinterest as PinterestGlyph,
  Reddit as RedditGlyph,
  Slack as SlackGlyph,
  Snapchat as SnapchatGlyph,
  Spotify as SpotifyGlyph,
  Telegram as TelegramGlyph,
  TikTok as TikTokGlyph,
  Twitch as TwitchGlyph,
  Twitter as TwitterGlyph,
  WhatsApp as WhatsAppGlyph,
  YouTube as YouTubeGlyph,
} from 'brandkitjs'
import type { ComponentType } from 'react'

import { cn } from '@/shared/lib/utils'

export type BrandIconProps = {
  /** Sizing utility such as `size-4`. Brandkit's own SVG ignores className. */
  className?: string
}

export type BrandIconComponent = ComponentType<BrandIconProps>

/** Official brand hex colours, used for the SVG fill. */
export const BRAND_ICON_COLORS = {
  discord: '#5865F2',
  telegram: '#26A5E4',
  whatsapp: '#25D366',
  github: '#181717',
  twitter: '#1DA1F2',
  youtube: '#FF0000',
  facebook: '#1877F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  reddit: '#FF4500',
  tiktok: '#000000',
  medium: '#000000',
  spotify: '#1DB954',
  twitch: '#9146FF',
  slack: '#4A154B',
  google: '#4285F4',
  pinterest: '#E60023',
  snapchat: '#FFFC00',
} as const

export type BrandIconName = keyof typeof BRAND_ICON_COLORS

type GlyphComponent = ComponentType<{ size?: number | string; color?: string }>

/**
 * Wrap a brandkit SVG so it behaves like the lucide icons it replaces.
 *
 * Brandkit renders its own fixed-size `<svg>` and drops `className`, so the
 * wrapper owns the box (`size-[1.1em]`, overridable by the caller's sizing
 * utility) and the SVG fills it. The official brand colour is applied
 * explicitly instead of relying on the library default.
 */
function createBrandIcon(
  name: BrandIconName,
  Glyph: GlyphComponent,
  color: string
): BrandIconComponent {
  const BrandIcon = ({ className }: BrandIconProps) => (
    <span
      className={cn(
        'inline-flex size-[1.1em] shrink-0 items-center justify-center',
        className
      )}
    >
      <Glyph size='100%' color={color} />
    </span>
  )
  BrandIcon.displayName = `${name[0].toUpperCase()}${name.slice(1)}BrandIcon`
  return BrandIcon
}

/** Colourful brand icons keyed by brand slug. */
export const BrandIcons = {
  discord: createBrandIcon('discord', DiscordGlyph, BRAND_ICON_COLORS.discord),
  telegram: createBrandIcon(
    'telegram',
    TelegramGlyph,
    BRAND_ICON_COLORS.telegram
  ),
  whatsapp: createBrandIcon(
    'whatsapp',
    WhatsAppGlyph,
    BRAND_ICON_COLORS.whatsapp
  ),
  github: createBrandIcon('github', GithubGlyph, BRAND_ICON_COLORS.github),
  twitter: createBrandIcon('twitter', TwitterGlyph, BRAND_ICON_COLORS.twitter),
  youtube: createBrandIcon('youtube', YouTubeGlyph, BRAND_ICON_COLORS.youtube),
  facebook: createBrandIcon(
    'facebook',
    FacebookGlyph,
    BRAND_ICON_COLORS.facebook
  ),
  instagram: createBrandIcon(
    'instagram',
    InstagramGlyph,
    BRAND_ICON_COLORS.instagram
  ),
  linkedin: createBrandIcon(
    'linkedin',
    LinkedInGlyph,
    BRAND_ICON_COLORS.linkedin
  ),
  reddit: createBrandIcon('reddit', RedditGlyph, BRAND_ICON_COLORS.reddit),
  tiktok: createBrandIcon('tiktok', TikTokGlyph, BRAND_ICON_COLORS.tiktok),
  medium: createBrandIcon('medium', MediumGlyph, BRAND_ICON_COLORS.medium),
  spotify: createBrandIcon('spotify', SpotifyGlyph, BRAND_ICON_COLORS.spotify),
  twitch: createBrandIcon('twitch', TwitchGlyph, BRAND_ICON_COLORS.twitch),
  slack: createBrandIcon('slack', SlackGlyph, BRAND_ICON_COLORS.slack),
  google: createBrandIcon('google', GoogleGlyph, BRAND_ICON_COLORS.google),
  pinterest: createBrandIcon(
    'pinterest',
    PinterestGlyph,
    BRAND_ICON_COLORS.pinterest
  ),
  snapchat: createBrandIcon(
    'snapchat',
    SnapchatGlyph,
    BRAND_ICON_COLORS.snapchat
  ),
} satisfies Record<BrandIconName, BrandIconComponent>
