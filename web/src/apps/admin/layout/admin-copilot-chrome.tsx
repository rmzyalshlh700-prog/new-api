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
import { useChatContext, type WindowProps } from '@copilotkit/react-ui'
import { Sparkles, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils'

export const ADMIN_COPILOT_WINDOW_ID = 'admin-copilot-window'

const FAB_CLASS = 'admin-copilot-fab'
const FAB_SELECTOR = `.${FAB_CLASS}`

/**
 * Floating toggle for the Admin Copilot.
 *
 * CopilotKit's own bubble is fixed to the bottom-right corner, which points at
 * the wrong side of the screen in Arabic. This button replaces it: the anchor
 * uses the logical `end` inset, so it sits bottom-right under `dir=ltr` and
 * bottom-left under `dir=rtl`, and it reads the chat's open state from the same
 * context the built-in button used, so click-outside, Escape and the panel's
 * own close button all stay in sync.
 *
 * `z-index` is high within the assistant layer, which itself sits above page
 * content and the sticky header (40) and below dialogs and sheets (50).
 */
export function AdminCopilotFab() {
  const { t } = useTranslation()
  const { open, setOpen } = useChatContext()

  return (
    <button
      type='button'
      className={cn(
        FAB_CLASS,
        'fixed end-4 bottom-4 z-[9999] flex size-14 items-center justify-center',
        'rounded-full border border-border/60 bg-primary text-primary-foreground shadow-lg',
        'transition-transform duration-200 hover:scale-105 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      )}
      aria-label={open ? t('Close Admin Copilot') : t('Open Admin Copilot')}
      aria-expanded={open}
      aria-controls={ADMIN_COPILOT_WINDOW_ID}
      onClick={() => setOpen(!open)}
    >
      {open ? (
        <X className='size-6' aria-hidden='true' />
      ) : (
        <Sparkles className='size-6' aria-hidden='true' />
      )}
    </button>
  )
}

/**
 * Chat panel for the Admin Copilot.
 *
 * Replaces CopilotKit's window, which below 640px is pinned to `inset: 0` and
 * therefore renders its title bar on top of the site header. This panel starts
 * below the sticky app header instead, stretches to full width on mobile and
 * stays a floating card on desktop. Dropping the library window also drops its
 * `visualViewport` handler, which locked `body` to `position: fixed` and froze
 * the dashboard as soon as the chat opened on a phone.
 *
 * Outside-click, Escape and the keyboard shortcut are reimplemented here
 * because they lived in the component this one replaces.
 */
export function AdminCopilotWindow({
  children,
  clickOutsideToClose,
  hitEscapeToClose,
  shortcut,
}: WindowProps) {
  const { t } = useTranslation()
  const { open, setOpen } = useChatContext()
  const windowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!clickOutsideToClose) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (windowRef.current?.contains(target)) return
      // The toggle is a sibling of the window and closes the chat itself, so a
      // press on it must not be treated as a click outside.
      if (document.querySelector(FAB_SELECTOR)?.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && hitEscapeToClose) {
        setOpen(false)
        return
      }
      if (!shortcut || event.key !== shortcut) return
      if (!(event.metaKey || event.ctrlKey)) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      setOpen(!open)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [clickOutsideToClose, hitEscapeToClose, open, setOpen, shortcut])

  return (
    <div
      ref={windowRef}
      id={ADMIN_COPILOT_WINDOW_ID}
      role='dialog'
      aria-label={t('Admin Copilot')}
      aria-hidden={!open}
      // `inert` keeps the collapsed panel out of the tab order and the
      // accessibility tree; CopilotKit only fades it to `pointer-events: none`.
      inert={!open}
      className={cn('copilotKitWindow admin-copilot-window', open && 'open')}
    >
      {children}
    </div>
  )
}
