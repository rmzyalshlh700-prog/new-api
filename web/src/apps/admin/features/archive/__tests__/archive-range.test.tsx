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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/lib/api'
import { formatDateStr } from '@/shared/lib/format'

import { ArchiveExplorer } from '../ArchiveExplorer'
import { isValidArchiveRange, type ArchiveRange } from '../api'
import { SummaryTab } from '../components/archive-tables'

const SUMMARY_PAYLOAD = {
  data: { success: true, message: '', data: { items: [], total: 0 } },
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return userEvent.setup()
}

/**
 * The Calendar stamps each day button with the locale-formatted date, which is
 * the only handle that survives the calendar's grid markup across months.
 */
function calendarDayStamp(date: Date) {
  return date.toLocaleDateString('en-US-u-ca-gregory')
}

async function openCalendar(label: string) {
  const popup = await waitFor(() => {
    const element = document.querySelector<HTMLElement>(
      '[data-slot="popover-content"][data-open]'
    )
    if (!element) throw new Error(`${label} calendar did not open`)
    return element
  })
  return popup
}

/** Selects a day in the open calendar of the named filter. */
async function pickDay(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  date: Date
) {
  await user.click(screen.getByLabelText(label))
  const popup = await openCalendar(label)
  const cell = popup.querySelector<HTMLButtonElement>(
    `[data-day="${calendarDayStamp(date)}"]`
  )
  expect(cell).not.toBeNull()
  await user.click(cell as HTMLButtonElement)
  await user.keyboard('{Escape}')
}

function yesterday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('archive date range guard', () => {
  it('keeps Apply disabled and sends nothing while the range is invalid', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(SUMMARY_PAYLOAD)
    const user = renderWithQuery(<ArchiveExplorer />)
    const today = new Date()

    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(get).not.toHaveBeenCalled()

    await pickDay(user, 'Start date', today)

    // A half-picked range is never committed, so no query is issued.
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
    expect(get).not.toHaveBeenCalled()

    // The guard the Apply button uses rejects a reversed range outright. The
    // pickers' min/max bounds already make it unreachable through the UI.
    expect(
      isValidArchiveRange({
        start_date: formatDateStr(today),
        end_date: formatDateStr(yesterday(today)),
      })
    ).toBe(false)
  })

  it('never queries the summary API for a reversed range', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(SUMMARY_PAYLOAD)
    const today = new Date()
    const reversed: ArchiveRange = {
      start_date: formatDateStr(today),
      end_date: formatDateStr(yesterday(today)),
    }

    renderWithQuery(<SummaryTab range={reversed} />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(get).not.toHaveBeenCalled()
  })

  it('commits a valid range with exactly one summary request', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(SUMMARY_PAYLOAD)
    const user = renderWithQuery(<ArchiveExplorer />)
    const today = new Date()

    await pickDay(user, 'Start date', today)
    await pickDay(user, 'End date', today)

    const apply = screen.getByRole('button', { name: 'Apply' })
    expect(apply).toBeEnabled()
    await user.click(apply)

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    expect(get).toHaveBeenCalledWith('/api/admin/archive/summary', {
      params: {
        start_date: formatDateStr(today),
        end_date: formatDateStr(today),
      },
    })
  })
})
