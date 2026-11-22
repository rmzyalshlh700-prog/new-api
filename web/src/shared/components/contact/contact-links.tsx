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
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

import {
  CONTACT_LINK_POSITIONS,
  getContactLinkIcon,
  SIDEBAR_LINK_POSITIONS,
  socialIconSizeClass,
  type ContactLink,
  type ContactLinkPosition,
} from './contact-links-data'
import {
  useContactLinkDisplayPreferences,
  useContactLinks,
} from './use-contact-links'

function filterLinks(
  links: ContactLink[] | undefined,
  position: ContactLinkPosition
): ContactLink[] {
  return (links ?? []).filter(
    (link) => link.is_active && link.position === position && link.url
  )
}

interface ContactLinkButtonProps {
  link: ContactLink
  className?: string
}

export function ContactLinkButton(props: ContactLinkButtonProps) {
  const { t } = useTranslation()
  const { iconSize } = useContactLinkDisplayPreferences()
  const Icon = getContactLinkIcon(props.link.icon)

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href={props.link.url}
              target='_blank'
              rel='noopener noreferrer'
              aria-label={props.link.title}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-md transition duration-200 hover:-translate-y-0.5 hover:bg-accent',
                props.className
              )}
            />
          }
        >
          <Icon className={socialIconSizeClass(iconSize)} />
          <span className='sr-only'>
            {props.link.title || t('Contact link')}
          </span>
        </TooltipTrigger>
        <TooltipContent>{props.link.title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface SidebarContactLinksProps {
  position: ContactLinkPosition
}

/**
 * Renders the social group in the sidebar slot the administrator selected.
 *
 * `position` names the slot this instance occupies: the group paints only
 * when it matches the configured placement, so a "footer" placement keeps
 * the links out of the sidebar entirely. Links are picked by their own
 * sidebar placement, so changing the administrator's choice moves the whole
 * group without rewriting each link. Renders nothing when there is no match.
 */
export function SidebarContactLinks(props: SidebarContactLinksProps) {
  const { data: links, isLoading } = useContactLinks()
  const { placement } = useContactLinkDisplayPreferences()
  if (isLoading) {
    return null
  }

  if (
    placement === CONTACT_LINK_POSITIONS.footer ||
    placement !== props.position
  ) {
    return null
  }

  const visible = (links ?? []).filter(
    (link) =>
      link.is_active &&
      link.url &&
      SIDEBAR_LINK_POSITIONS.includes(link.position)
  )
  if (visible.length === 0) {
    return null
  }

  const isBottom = props.position === CONTACT_LINK_POSITIONS.sidebarBottom

  return (
    <div
      className={cn(
        'flex items-center gap-1 border-border/70 px-2',
        isBottom
          ? 'mt-auto justify-center border-t pt-2 pb-1'
          : 'justify-start border-b pb-2 pt-1'
      )}
    >
      {visible.map((link) => (
        <ContactLinkButton key={link.id} link={link} />
      ))}
    </div>
  )
}

/**
 * Social links in the site footer. Links placed in the footer always render
 * here; when the administrator picks "Footer Only", the links that would
 * otherwise live in the sidebar move down here as well.
 */
export function FooterContactLinks() {
  const { data: links, isLoading } = useContactLinks()
  const { placement } = useContactLinkDisplayPreferences()
  if (isLoading) {
    return null
  }

  const footerOnly = placement === CONTACT_LINK_POSITIONS.footer
  const visible = (links ?? []).filter((link) => {
    if (!link.is_active || !link.url) return false
    if (link.position === CONTACT_LINK_POSITIONS.footer) return true
    return footerOnly && SIDEBAR_LINK_POSITIONS.includes(link.position)
  })
  if (visible.length === 0) {
    return null
  }

  return (
    <div className='flex shrink-0 items-center gap-1'>
      {visible.map((link) => (
        <ContactLinkButton key={link.id} link={link} className='size-7' />
      ))}
    </div>
  )
}

/**
 * Compact icon buttons for the header_top position, rendered next to the
 * language/theme toggler in the top navigation bar.
 */
export function HeaderContactLinks() {
  const { data: links, isLoading } = useContactLinks()
  if (isLoading) {
    return null
  }

  const visible = filterLinks(links, CONTACT_LINK_POSITIONS.headerTop)
  if (visible.length === 0) {
    return null
  }

  return (
    <div className='flex shrink-0 items-center gap-0.5'>
      {visible.map((link) => (
        <ContactLinkButton key={link.id} link={link} className='size-7' />
      ))}
    </div>
  )
}
