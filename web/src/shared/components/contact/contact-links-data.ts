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
  Activity,
  Bot,
  Code,
  Coins,
  Cpu,
  CreditCard,
  Globe,
  Headphones,
  HelpCircle,
  Home,
  Image,
  Library,
  LifeBuoy,
  Mail,
  MessagesSquare,
  Newspaper,
  Package,
  Play,
  Rocket,
  Settings,
  Share2,
  ShoppingBag,
  Star,
  Store,
  Users,
  Video,
  Webhook,
  Zap,
} from 'lucide-react'
import type { ComponentType } from 'react'

import { BrandIcons } from './brand-icons'

export const CONTACT_LINK_POSITIONS = {
  sidebarBottom: 'sidebar_bottom',
  sidebarTop: 'sidebar_top',
  headerTop: 'header_top',
  footer: 'footer',
} as const

export type ContactLinkPosition =
  (typeof CONTACT_LINK_POSITIONS)[keyof typeof CONTACT_LINK_POSITIONS]

export interface ContactLink {
  id: string
  title: string
  url: string
  icon: string
  position: ContactLinkPosition
  is_active: boolean
}

/**
 * Icon component accepted by the contact-link renderer. Both lucide icons and
 * the colourful brand wrappers are sized through `className`.
 */
export type ContactLinkIcon = ComponentType<{ className?: string }>

export interface ContactLinkIconEntry {
  name: string
  icon: ContactLinkIcon
  label: string
}

/**
 * Curated icon registry shared by the admin icon picker and the client
 * renderer. Icon names are stable identifiers stored in the backend, so the
 * legacy lucide names (`send`, `message-circle`) stay valid even though they
 * now render their colourful brand glyph.
 */
export const CONTACT_LINK_ICONS: ContactLinkIconEntry[] = [
  { name: 'send', icon: BrandIcons.telegram, label: 'Telegram' },
  { name: 'message-circle', icon: BrandIcons.discord, label: 'Discord' },
  { name: 'whatsapp', icon: BrandIcons.whatsapp, label: 'WhatsApp' },
  { name: 'github', icon: BrandIcons.github, label: 'GitHub' },
  { name: 'twitter', icon: BrandIcons.twitter, label: 'Twitter' },
  { name: 'youtube', icon: BrandIcons.youtube, label: 'YouTube' },
  { name: 'instagram', icon: BrandIcons.instagram, label: 'Instagram' },
  { name: 'facebook', icon: BrandIcons.facebook, label: 'Facebook' },
  { name: 'linkedin', icon: BrandIcons.linkedin, label: 'LinkedIn' },
  { name: 'reddit', icon: BrandIcons.reddit, label: 'Reddit' },
  { name: 'tiktok', icon: BrandIcons.tiktok, label: 'TikTok' },
  { name: 'medium', icon: BrandIcons.medium, label: 'Medium' },
  { name: 'spotify', icon: BrandIcons.spotify, label: 'Spotify' },
  { name: 'twitch', icon: BrandIcons.twitch, label: 'Twitch' },
  { name: 'slack', icon: BrandIcons.slack, label: 'Slack' },
  { name: 'google', icon: BrandIcons.google, label: 'Google' },
  { name: 'pinterest', icon: BrandIcons.pinterest, label: 'Pinterest' },
  { name: 'snapchat', icon: BrandIcons.snapchat, label: 'Snapchat' },
  { name: 'messages-square', icon: MessagesSquare, label: 'Chat' },
  { name: 'bot', icon: Bot, label: 'Bot' },
  { name: 'life-buoy', icon: LifeBuoy, label: 'Support' },
  { name: 'headphones', icon: Headphones, label: 'Customer Service' },
  { name: 'help-circle', icon: HelpCircle, label: 'FAQ' },
  { name: 'globe', icon: Globe, label: 'Website' },
  { name: 'mail', icon: Mail, label: 'Email' },
  { name: 'play', icon: Play, label: 'Media' },
  { name: 'share-2', icon: Share2, label: 'Social' },
  { name: 'users', icon: Users, label: 'Community' },
  { name: 'star', icon: Star, label: 'Reviews' },
  { name: 'newspaper', icon: Newspaper, label: 'News' },
  { name: 'library', icon: Library, label: 'Docs' },
  { name: 'code', icon: Code, label: 'Developer' },
  { name: 'rocket', icon: Rocket, label: 'Launch' },
  { name: 'zap', icon: Zap, label: 'Quick Start' },
  { name: 'home', icon: Home, label: 'Home' },
  { name: 'store', icon: Store, label: 'Store' },
  { name: 'shopping-bag', icon: ShoppingBag, label: 'Shop' },
  { name: 'package', icon: Package, label: 'Products' },
  { name: 'credit-card', icon: CreditCard, label: 'Payments' },
  { name: 'coins', icon: Coins, label: 'Pricing' },
  { name: 'activity', icon: Activity, label: 'Status' },
  { name: 'cpu', icon: Cpu, label: 'API' },
  { name: 'webhook', icon: Webhook, label: 'Integrations' },
  { name: 'settings', icon: Settings, label: 'Settings' },
  { name: 'image', icon: Image, label: 'Gallery' },
  { name: 'video', icon: Video, label: 'Video' },
]

export function getContactLinkIcon(name: string): ContactLinkIcon {
  return CONTACT_LINK_ICONS.find((entry) => entry.name === name)?.icon ?? Globe
}
