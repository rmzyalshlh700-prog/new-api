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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { AdminCopilotFab } from '../admin-copilot-chrome'
import {
  COPILOT_FAB_DRAG_THRESHOLD,
  clampCopilotFabPosition,
  readCopilotFabPosition,
} from '../use-admin-copilot-fab-drag'

const setOpen = vi.fn()

vi.mock('@copilotkit/react-ui', () => ({
  useChatContext: () => ({ open: false, setOpen }),
}))

const STORAGE_KEY = 'admin-copilot-fab:position'
const SIZE = 48
const MARGIN = 12
// jsdom has no layout, so the hook falls back to the window size.
const VIEWPORT_WIDTH = 1024
const VIEWPORT_HEIGHT = 768

/** Bottom-right slot: the LTR default. */
const DEFAULT_X = VIEWPORT_WIDTH - SIZE - MARGIN
const DEFAULT_Y = VIEWPORT_HEIGHT - SIZE - MARGIN

let captured: { pointerId: number }[] = []

function press(element: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(element, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
    clientX: x,
    clientY: y,
  })
}

function move(element: HTMLElement, x: number, y: number) {
  fireEvent.pointerMove(element, {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    clientX: x,
    clientY: y,
  })
}

function release(element: HTMLElement, x: number, y: number) {
  fireEvent.pointerUp(element, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    isPrimary: true,
    clientX: x,
    clientY: y,
  })
}

function getFab(): HTMLElement {
  return screen.getByRole('button', { name: 'Open Admin Copilot' })
}

function leftOf(element: HTMLElement) {
  return Number.parseFloat(element.style.left)
}

function topOf(element: HTMLElement) {
  return Number.parseFloat(element.style.top)
}

beforeEach(() => {
  setOpen.mockClear()
  captured = []
  window.localStorage.clear()
  // Pointer capture exists in browsers but not in jsdom.
  HTMLElement.prototype.setPointerCapture = function (pointerId: number): void {
    captured.push({ pointerId })
  }
  HTMLElement.prototype.hasPointerCapture = (pointerId: number): boolean =>
    captured.some((entry) => entry.pointerId === pointerId)
  HTMLElement.prototype.releasePointerCapture = (pointerId: number): void => {
    captured = captured.filter((entry) => entry.pointerId !== pointerId)
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('opens at the bottom corner of the reading direction with the smaller size', () => {
  render(<AdminCopilotFab />)
  const fab = getFab()

  expect(fab.className).toContain('size-12')
  expect(leftOf(fab)).toBe(DEFAULT_X)
  expect(topOf(fab)).toBe(DEFAULT_Y)
})

test('renders in a portal so its fixed coordinates follow the viewport', () => {
  render(<AdminCopilotFab />)
  const fab = getFab()

  // Not inside the library's popup wrapper, which is itself `position: fixed`
  // and could offset or clip a dragged button.
  expect(fab.parentElement).toBe(document.body)
})

test('a press without movement still opens the chat', () => {
  render(<AdminCopilotFab />)
  const fab = getFab()

  press(fab, DEFAULT_X + 20, DEFAULT_Y + 20)
  release(fab, DEFAULT_X + 20, DEFAULT_Y + 20)
  fireEvent.click(fab)

  expect(setOpen).toHaveBeenCalledWith(true)
})

test('dragging follows the pointer exactly and never opens the chat', async () => {
  render(<AdminCopilotFab />)
  const fab = getFab()

  press(fab, DEFAULT_X + 24, DEFAULT_Y + 24)
  move(fab, DEFAULT_X + 24 - 300, DEFAULT_Y + 24 - 200)

  await waitFor(() => {
    expect(leftOf(fab)).toBe(DEFAULT_X - 300)
    expect(topOf(fab)).toBe(DEFAULT_Y - 200)
  })

  release(fab, DEFAULT_X + 24 - 300, DEFAULT_Y + 24 - 200)
  fireEvent.click(fab)

  expect(setOpen).not.toHaveBeenCalled()
  expect(readCopilotFabPosition(STORAGE_KEY)).toEqual({
    x: DEFAULT_X - 300,
    y: DEFAULT_Y - 200,
  })
})

test('a jitter under the threshold is a tap, not a drag', async () => {
  render(<AdminCopilotFab />)
  const fab = getFab()

  press(fab, DEFAULT_X + 24, DEFAULT_Y + 24)
  move(fab, DEFAULT_X + 24 + COPILOT_FAB_DRAG_THRESHOLD - 1, DEFAULT_Y + 24)
  release(fab, DEFAULT_X + 24 + COPILOT_FAB_DRAG_THRESHOLD - 1, DEFAULT_Y + 24)
  fireEvent.click(fab)

  expect(leftOf(fab)).toBe(DEFAULT_X)
  expect(setOpen).toHaveBeenCalledWith(true)
})

test('dragging past an edge stops at the viewport margin', async () => {
  render(<AdminCopilotFab />)
  const fab = getFab()

  press(fab, DEFAULT_X + 24, DEFAULT_Y + 24)
  move(fab, -500, -500)

  await waitFor(() => {
    expect(leftOf(fab)).toBe(MARGIN)
    expect(topOf(fab)).toBe(MARGIN)
  })

  move(fab, 5000, 5000)

  await waitFor(() => {
    expect(leftOf(fab)).toBe(DEFAULT_X)
    expect(topOf(fab)).toBe(DEFAULT_Y)
  })
})

test('reopens where it was dropped, and never off screen', () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 320, y: 200 }))
  const first = render(<AdminCopilotFab />)
  let fab = getFab()
  expect(leftOf(fab)).toBe(320)
  expect(topOf(fab)).toBe(200)
  first.unmount()

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ x: 9_000, y: 9_000 })
  )
  render(<AdminCopilotFab />)
  fab = getFab()
  expect(leftOf(fab)).toBe(DEFAULT_X)
  expect(topOf(fab)).toBe(DEFAULT_Y)
})

test('ignores a malformed stored position', () => {
  window.localStorage.setItem(STORAGE_KEY, '{"x":"left","y":null}')
  render(<AdminCopilotFab />)

  expect(leftOf(getFab())).toBe(DEFAULT_X)
})

test('stands down while the mobile navigation drawer is open', async () => {
  render(<AdminCopilotFab />)
  expect(getFab()).toBeTruthy()

  // The drawer is a sheet portalled to the body; its marker attribute is what
  // the launcher watches for.
  const drawer = document.createElement('div')
  drawer.setAttribute('data-slot', 'sidebar')
  drawer.setAttribute('data-mobile', 'true')
  document.body.append(drawer)

  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: 'Open Admin Copilot' })
    ).toBeNull()
  })

  drawer.remove()

  await waitFor(() => {
    expect(getFab()).toBeTruthy()
  })
})

test('clamp keeps the button inside any viewport', () => {
  expect(clampCopilotFabPosition({ x: -40, y: -40 }, SIZE, MARGIN)).toEqual({
    x: MARGIN,
    y: MARGIN,
  })
  expect(
    clampCopilotFabPosition({ x: 10_000, y: 10_000 }, SIZE, MARGIN)
  ).toEqual({ x: DEFAULT_X, y: DEFAULT_Y })
})
