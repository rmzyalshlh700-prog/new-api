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
import type { PaymentLogEntry } from '@/apps/admin/features/payment-logs/types'
import { api } from '@/shared/lib/api'

import { buildArchiveWorkbook } from './export'

export interface DailyArchive {
  id: number
  date: string
  total_revenue: number
  total_cost: number
  total_tokens: number
  total_requests: number
  new_users: number
  new_api_keys: number
  top_up_amount: number
}

export interface ArchiveLog {
  id: number
  created_at: number
  username: string
  model_name: string
  token_name: string
  quota: number
  prompt_tokens: number
  completion_tokens: number
}

/** One API key created on the archived day (export sheet, no key material). */
export interface ArchiveNewKeyEntry {
  id: number
  user_id: number
  username: string
  name: string
  created_time: number
}

export interface ArchiveRange {
  start_date: string
  end_date: string
}

/**
 * A committed range is queryable only when both dates are present and
 * ordered. Callers gate their queries on this so a half-picked or reversed
 * range never reaches the backend (which would reject it) and cannot drive a
 * refetch/render loop. YYYY-MM-DD strings compare correctly as strings.
 */
export function isValidArchiveRange(
  range: ArchiveRange | null
): range is ArchiveRange {
  return (
    range !== null &&
    range.start_date !== '' &&
    range.end_date !== '' &&
    range.start_date <= range.end_date
  )
}

export interface ArchivePage<T> {
  items: T[]
  total: number
}

interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data?: T
}

export async function getArchiveSummary(
  params: ArchiveRange
): Promise<ApiEnvelope<DailyArchive[]>> {
  const response = await api.get('/api/admin/archive/summary', { params })
  return response.data
}

export async function getArchiveLogs(
  params: ArchiveRange & { p: number; page_size: number }
): Promise<ApiEnvelope<ArchivePage<ArchiveLog>>> {
  const response = await api.get('/api/admin/archive/logs', { params })
  return response.data
}

export async function getArchivePayments(
  params: ArchiveRange & { p: number; page_size: number }
): Promise<ApiEnvelope<ArchivePage<PaymentLogEntry>>> {
  const response = await api.get('/api/admin/archive/payments', { params })
  return response.data
}

/** Raw structured export payload served by /api/admin/archive/export. */
export interface ArchiveExportPayload {
  date: string
  summary: DailyArchive | null
  invoices: PaymentLogEntry[]
  new_keys: ArchiveNewKeyEntry[]
}

interface ArchiveLogExportEnvelope {
  success: boolean
  message?: string
  data?: unknown
}

/** Download one day's report as a multi-sheet XLSX workbook. */
export async function exportArchiveDay(
  date: string,
  logs: ArchiveLog[]
): Promise<void> {
  const response = await api.get<ArchiveLogExportEnvelope>(
    '/api/admin/archive/export',
    { params: { date } }
  )
  const envelope = response.data
  if (!envelope.success || !envelope.data) {
    throw new Error(envelope.message || 'Failed to export archive')
  }
  const payload = envelope.data as ArchiveExportPayload
  const blob = buildArchiveWorkbook({
    date: payload.date || date,
    summary: payload.summary,
    invoices: payload.invoices ?? [],
    newKeys: payload.new_keys ?? [],
    logs,
  })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `archive-${date}.xlsx`
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
