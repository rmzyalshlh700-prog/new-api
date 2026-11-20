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
import { Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils'

import { useCopilotFabDrag } from './use-admin-copilot-fab-drag'

export const ADMIN_COPILOT_WINDOW_ID = 'admin-copilot-window'

const FAB_CLASS = 'admin-copilot-fab'
const FAB_SELECTOR = `.${FAB_CLASS}`
/** Rendered edge length of the launcher in CSS pixels (`size-12`). */
const FAB_SIZE = 48
const FAB_POSITION_STORAGE_KEY = 'admin-copilot-fab:position'
const MOBILE_NAV_SELECTOR = '[data-slot="sidebar"][data-mobile="true"]'

/**
 * Every modal surface that can cover the launcher: the mobile navigation
 * drawer, dialogs, confirmation dialogs and slide-over sheets.
 *
 * All of them portal to `document.body`, and the launcher renders above the
 * shell through CopilotKit's own portal, so no React context is reachable
 * here. Their marker attributes are: watching the body for them keeps the
 * launcher in sync without threading a context through the assistant layer.
 */
const MODAL_SURFACE_SELECTOR = [
  MOBILE_NAV_SELECTOR,
  '[data-slot="dialog-content"]',
  '[data-slot="alert-dialog-content"]',
  '[data-slot="sheet-content"]',
].join(', ')

/**
 * Whether a modal surface above the launcher is open.
 *
 * A closing surface stays mounted for the length of its exit animation, so the
 * `data-closed` marker is excluded rather than relying on unmount timing.
 */
function useOverlayOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const read = () => {
      const surfaces = document.querySelectorAll(MODAL_SURFACE_SELECTOR)
      let visible = false
      for (const surface of surfaces) {
        if (surface.getAttribute('data-closed') !== null) continue
        visible = true
        break
      }
      setOpen(visible)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-open', 'data-closed', 'data-slot'],
    })
    return () => observer.disconnect()
  }, [])

  return open
}

/**
 * Floating toggle for the Admin Copilot.
 *
 * CopilotKit's own bubble is fixed to the bottom-right corner, which points at
 * the wrong side of the screen in Arabic. This button replaces it: it starts in
 * the lower corner of the reading direction, so bottom-right under `dir=ltr`
 * and bottom-left under `dir=rtl`, and it reads the chat's open state from the
 * same context the built-in button used, so click-outside, Escape and the
 * panel's own close button all stay in sync.
 *
 * `z-index` is high within the assistant layer, which itself sits above page
 * content and the sticky header (40) and below dialogs and sheets (50).
 *
 * The launcher is hidden while the panel is open. As a floating `end`-anchored
 * circle it landed on top of the composer — and on the send button in Arabic,
 * where `end` is the left edge — so closing now happens in the panel header,
 * with Escape and click-outside as the other ways out.
 *
 * It also stands down while any modal surface is open. The mobile navigation
 * drawer is the full-height sheet on a phone, where a fixed launcher parked
 * over it covered the last sidebar entries (Authentication, Security &
 * Limits); the same applied to dialogs and slide-over sheets, whose footer
 * actions sit in the corner the launcher occupies (the cancel and save buttons
 * of a right-hand sheet under `dir=rtl`).
 *
 * It can be dragged anywhere on screen: the position is held in viewport
 * pixels, kept inside the viewport and remembered in `localStorage`, so the
 * launcher reopens where the operator put it. A drag never counts as a tap,
 * and a tap still opens the panel.
 *
 * The button is portalled to `document.body` so its `fixed` coordinates are
 * measured against the viewport. Inside the library's popup wrapper — which is
 * itself `position: fixed` and may grow a transform or `overflow` — the drag
 * could otherwise be offset or clipped at the screen edges.
 */
export function AdminCopilotFab() {
  const { t } = useTranslation()
  const { open, setOpen } = useChatContext()
  const overlayOpen = useOverlayOpen()
  const {
    buttonRef,
    style: fabStyle,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeDragClick,
  } = useCopilotFabDrag({
    size: FAB_SIZE,
    storageKey: FAB_POSITION_STORAGE_KEY,
  })

  if (open || overlayOpen) {
    return null
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <button
      ref={buttonRef}
      type='button'
      style={fabStyle}
      className={cn(
        FAB_CLASS,
        'fixed z-[9999] flex size-12 touch-none items-center justify-center select-none',
        'rounded-full border border-border/60 bg-primary text-primary-foreground shadow-lg',
        dragging
          ? 'scale-105 cursor-grabbing shadow-xl'
          : 'cursor-grab transition-transform duration-200 hover:scale-105 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      )}
      aria-label={t('Open Admin Copilot')}
      aria-expanded={false}
      aria-controls={ADMIN_COPILOT_WINDOW_ID}
      title={t('Drag to move')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={() => {
        // The click the browser fires at the end of a drag must not open the
        // panel; only a real tap does.
        if (consumeDragClick()) return
        setOpen(true)
      }}
    >
      <Sparkles className='size-5' aria-hidden='true' />
    </button>,
    document.body
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
