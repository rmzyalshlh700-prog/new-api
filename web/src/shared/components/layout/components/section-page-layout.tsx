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
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

import { ConsolePageHeader } from '@/shared/components/console'

import { Main } from './main'
import { PageFooterProvider } from './page-footer'

type SlotProps = { children?: ReactNode }

function SectionPageLayoutTitle(_props: SlotProps) {
  return null
}
SectionPageLayoutTitle.displayName = 'SectionPageLayout.Title'

function SectionPageLayoutHint(_props: SlotProps) {
  return null
}
SectionPageLayoutHint.displayName = 'SectionPageLayout.Hint'

function SectionPageLayoutActions(_props: SlotProps) {
  return null
}
SectionPageLayoutActions.displayName = 'SectionPageLayout.Actions'

function SectionPageLayoutContent(_props: SlotProps) {
  return null
}
SectionPageLayoutContent.displayName = 'SectionPageLayout.Content'

function SectionPageLayoutBreadcrumb(_props: SlotProps) {
  return null
}
SectionPageLayoutBreadcrumb.displayName = 'SectionPageLayout.Breadcrumb'

export type SectionPageLayoutProps = {
  children: ReactNode
  fixedContent?: boolean
  stackActionsOnMobile?: boolean
}

/**
 * Standard screen frame for every console page: one compact header block
 * (title, optional hint, end-aligned actions), one scrolling canvas and one
 * pinned footer slot for page-level pagination or form actions.
 *
 * Pages only fill the slots; the chrome itself is never re-implemented per
 * module, which is what keeps titles, spacing and action placement identical
 * across the whole console.
 */
export function SectionPageLayout(props: SectionPageLayoutProps) {
  const [footerContainer, setFooterContainer] = useState<HTMLDivElement | null>(
    null
  )

  let title: ReactNode = null
  let hint: ReactNode = null
  let actions: ReactNode = null
  let content: ReactNode = null
  let breadcrumb: ReactNode = null

  Children.forEach(props.children, (node) => {
    if (!isValidElement(node)) return
    const child = node as ReactElement<SlotProps>
    if (child.type === SectionPageLayoutTitle) title = child.props.children
    else if (child.type === SectionPageLayoutHint) hint = child.props.children
    else if (child.type === SectionPageLayoutActions) {
      actions = child.props.children
    } else if (child.type === SectionPageLayoutContent) {
      content = child.props.children
    } else if (child.type === SectionPageLayoutBreadcrumb) {
      breadcrumb = child.props.children
    }
  })

  return (
    <PageFooterProvider container={footerContainer}>
      <Main>
        <div className='shrink-0 px-3 pt-2.5 pb-2 sm:px-4 sm:pt-3 sm:pb-2.5'>
          {breadcrumb != null && <div className='mb-2'>{breadcrumb}</div>}
          <ConsolePageHeader title={title} hint={hint} actions={actions} />
        </div>

        <div
          className={
            props.fixedContent
              ? '[[data-portal=admin]_&]:bg-console-panel min-h-0 flex-1 overflow-hidden px-3 pt-2 pb-3 sm:px-4 sm:pt-2.5 sm:pb-4'
              : '[[data-portal=admin]_&]:bg-console-panel min-h-0 flex-1 overflow-auto px-3 pt-2 pb-3 sm:px-4 sm:pt-2.5 sm:pb-4'
          }
        >
          {content}
        </div>

        <div
          ref={setFooterContainer}
          className='bg-background shrink-0 border-t px-3 py-2 pb-[calc(var(--admin-overlay-bottom-size,0px)+0.5rem)] empty:hidden sm:px-4 sm:py-2.5 sm:pb-[calc(var(--admin-overlay-bottom-size,0px)+0.625rem)]'
        />
      </Main>
    </PageFooterProvider>
  )
}

SectionPageLayout.Title = SectionPageLayoutTitle
SectionPageLayout.Hint = SectionPageLayoutHint
SectionPageLayout.Actions = SectionPageLayoutActions
SectionPageLayout.Content = SectionPageLayoutContent
SectionPageLayout.Breadcrumb = SectionPageLayoutBreadcrumb
