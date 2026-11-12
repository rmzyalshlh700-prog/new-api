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

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

import {
  CONTACT_LINK_POSITIONS,
  getContactLinkIcon,
  type ContactLink,
  type ContactLinkPosition,
} from './contact-links-data'
import { useContactLinks } from './use-contact-links'

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
                'text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent',
                props.className
              )}
            />
          }
        >
          <Icon className='size-4' />
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
 * Renders active contact links assigned to sidebar_top / sidebar_bottom
 * inside the application sidebar. sidebar_bottom sticks to the end of the
 * navigation menu (Join Telegram/Discord style); sidebar_top renders above
 * the navigation groups. Renders nothing when there are no matching links.
 */
export function SidebarContactLinks(props: SidebarContactLinksProps) {
  const { data: links, isLoading } = useContactLinks()
  if (isLoading) {
    return null
  }

  const visible = filterLinks(links, props.position)
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
