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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/** Position of the launcher in viewport pixels, measured from the top-left. */
export interface CopilotFabPosition {
  x: number
  y: number
}

export interface CopilotFabDragOptions {
  /** Edge length of the button in CSS pixels, used before it can be measured. */
  size: number
  /** Gap kept between the button and every viewport edge. */
  margin?: number
  /** `localStorage` key holding the position the user dropped the button at. */
  storageKey: string
}

/** A pointer has to travel this far before the press becomes a drag. */
export const COPILOT_FAB_DRAG_THRESHOLD = 3

const DEFAULT_MARGIN = 12

function viewportWidth(): number {
  // `clientWidth` is the layout viewport without scrollbars; the `innerWidth`
  // fallback covers environments that report no layout box.
  return document.documentElement.clientWidth || window.innerWidth
}

function viewportHeight(): number {
  return document.documentElement.clientHeight || window.innerHeight
}

/**
 * Keeps the launcher fully inside the viewport. A viewport narrower than the
 * button plus its margins clamps to the top-left edge instead of pushing the
 * button off screen, so it can always be reached and dragged again.
 */
export function clampCopilotFabPosition(
  position: CopilotFabPosition,
  size: number,
  margin: number = DEFAULT_MARGIN
): CopilotFabPosition {
  const maxX = Math.max(margin, viewportWidth() - size - margin)
  const maxY = Math.max(margin, viewportHeight() - size - margin)
  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY),
  }
}

/**
 * Where the launcher sits before the user moves it: the lower corner of the
 * reading direction, so it stays on the same side as the chat in Arabic.
 */
export function defaultCopilotFabPosition(
  size: number,
  margin: number = DEFAULT_MARGIN
): CopilotFabPosition {
  const isRtl =
    typeof window !== 'undefined' &&
    getComputedStyle(document.documentElement).direction === 'rtl'
  return clampCopilotFabPosition(
    {
      x: isRtl ? margin : viewportWidth() - size - margin,
      y: viewportHeight() - size - margin,
    },
    size,
    margin
  )
}

/** Reads the saved position, ignoring anything malformed or unavailable. */
export function readCopilotFabPosition(
  storageKey: string
): CopilotFabPosition | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { x, y } = parsed as Record<string, unknown>
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null
    }
    return { x, y }
  } catch {
    return null
  }
}

function writeCopilotFabPosition(
  storageKey: string,
  position: CopilotFabPosition
) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(position))
  } catch {
    // Private mode or a full quota: the position then lasts for this visit.
  }
}

interface DragSession {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

/**
 * Drag-to-move behaviour for the Admin Copilot launcher.
 *
 * The button is placed with `left`/`top` in viewport pixels, so a drop lands
 * exactly where the pointer is: the offset is taken from the press position
 * rather than from the element's centre, which keeps the grab point under the
 * finger on every screen size. Moves are clamped to the viewport and committed
 * once per animation frame, so a slow drag never outruns the paint and a fast
 * one cannot leave the button half-drawn outside the screen.
 *
 * A press only becomes a drag after `COPILOT_FAB_DRAG_THRESHOLD` pixels, so a
 * tap still opens the chat, and the click the browser fires after a real drag
 * is swallowed by `consumeDragClick` instead of opening the panel.
 */
export function useCopilotFabDrag(options: CopilotFabDragOptions) {
  const size = options.size
  const margin = options.margin ?? DEFAULT_MARGIN
  const storageKey = options.storageKey
  const buttonRef = useRef<HTMLButtonElement>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const frameRef = useRef<number | null>(null)
  const dragClickRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [position, setPosition] = useState<CopilotFabPosition>(() => {
    const stored = readCopilotFabPosition(storageKey)
    return clampCopilotFabPosition(
      stored ?? defaultCopilotFabPosition(size, margin),
      size,
      margin
    )
  })
  const positionRef = useRef(position)

  /** The rendered box wins once mounted, so the clamp matches the real size. */
  const measure = useCallback(
    () => buttonRef.current?.offsetWidth || size,
    [size]
  )

  const commitPosition = useCallback((next: CopilotFabPosition) => {
    positionRef.current = next
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      setPosition(positionRef.current)
    })
  }, [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      // A second finger must not restart the drag mid-gesture.
      if (sessionRef.current) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const element = event.currentTarget
      if (typeof element.setPointerCapture === 'function') {
        try {
          element.setPointerCapture(event.pointerId)
        } catch {
          // Capture is an optimisation; the handlers still receive the moves.
        }
      }
      dragClickRef.current = false
      sessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: positionRef.current.x,
        originY: positionRef.current.y,
        moved: false,
      }
    },
    []
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = sessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      const deltaX = event.clientX - session.startX
      const deltaY = event.clientY - session.startY
      if (!session.moved) {
        if (Math.hypot(deltaX, deltaY) < COPILOT_FAB_DRAG_THRESHOLD) return
        session.moved = true
        setDragging(true)
      }
      if (event.cancelable) event.preventDefault()
      commitPosition(
        clampCopilotFabPosition(
          {
            x: session.originX + deltaX,
            y: session.originY + deltaY,
          },
          measure(),
          margin
        )
      )
    },
    [commitPosition, margin, measure]
  )

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const session = sessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      sessionRef.current = null
      const element = event.currentTarget
      if (
        typeof element.hasPointerCapture === 'function' &&
        typeof element.releasePointerCapture === 'function' &&
        element.hasPointerCapture(event.pointerId)
      ) {
        try {
          element.releasePointerCapture(event.pointerId)
        } catch {
          // Already released by the browser.
        }
      }
      setDragging(false)
      if (!session.moved) return
      dragClickRef.current = true
      writeCopilotFabPosition(
        storageKey,
        clampCopilotFabPosition(positionRef.current, measure(), margin)
      )
    },
    [margin, measure, storageKey]
  )

  /** True once for the click that follows a drag; the panel must not open. */
  const consumeDragClick = useCallback(() => {
    if (!dragClickRef.current) return false
    dragClickRef.current = false
    return true
  }, [])

  useEffect(() => {
    // Rotating a phone or resizing a window can leave a stored position
    // outside the new viewport; pull it back to the nearest visible edge.
    const keepVisible = () => {
      commitPosition(
        clampCopilotFabPosition(positionRef.current, measure(), margin)
      )
    }
    window.addEventListener('resize', keepVisible)
    window.addEventListener('orientationchange', keepVisible)
    return () => {
      window.removeEventListener('resize', keepVisible)
      window.removeEventListener('orientationchange', keepVisible)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [commitPosition, margin, measure])

  const style: CSSProperties = useMemo(
    () => ({ left: position.x, top: position.y }),
    [position.x, position.y]
  )

  return {
    buttonRef,
    style,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    consumeDragClick,
  }
}
