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
import * as XLSX from 'xlsx'

import { formatTimestampToDate } from '@/shared/lib/format'

import type { ArchiveLog, ArchiveNewKeyEntry, DailyArchive } from './api'
import type { PaymentLogEntry } from '@/apps/admin/features/payment-logs/types'

export interface ArchiveExportData {
  date: string
  summary: DailyArchive | null
  invoices: PaymentLogEntry[]
  newKeys: ArchiveNewKeyEntry[]
  logs: ArchiveLog[]
}

/** Neutralise spreadsheet formula injection in user-controlled text. */
function safeCell(value: string): string {
  if (value === '') return value
  switch (value[0]) {
    case '=':
    case '+':
    case '-':
    case '@':
    case '\t':
    case '\r':
      return `'${value}`
  }
  return value
}

function aoaToSheet(rows: (string | number)[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = rows[0].map((_, i) => ({
    wch: Math.max(
      12,
      ...rows.map((row) => String(row[i] ?? '').length + 2)
    ),
  }))
  return sheet
}

/**
 * Build the multi-sheet daily report workbook: Summary, Invoices, New API
 * Keys and Usage Logs. Export happens fully client-side from data already
 * fetched by the archive queries, so the file layout can stay presentation
 * quality (headers, formatting, column widths) without backend coupling.
 */
export function buildArchiveWorkbook(data: ArchiveExportData): Blob {
  const wb = XLSX.utils.book_new()

  const s = data.summary
  aoaAddSheet(wb, 'Summary', [
    ['Metric', 'Value'],
    ['Date', data.date],
    ['Revenue', s?.total_revenue ?? 0],
    ['Cost', s?.total_cost ?? 0],
    ['Net Profit', (s?.total_revenue ?? 0) - (s?.total_cost ?? 0)],
    ['Requests', s?.total_requests ?? 0],
    ['Tokens', s?.total_tokens ?? 0],
    ['New Users', s?.new_users ?? 0],
    ['New API Keys', s?.new_api_keys ?? 0],
    ['Top-up Amount', s?.top_up_amount ?? 0],
  ])

  aoaAddSheet(wb, 'Invoices', [
    ['Trade No', 'User', 'User ID', 'Amount', 'Paid', 'Method', 'Provider', 'Status', 'Time'],
    ...data.invoices.map((inv) => [
      safeCell(inv.trade_no),
      safeCell(inv.username || inv.user_email || `#${inv.user_id}`),
      inv.user_id,
      inv.amount,
      inv.money,
      safeCell(inv.payment_method),
      safeCell(inv.payment_provider),
      safeCell(inv.status),
      formatTimestampToDate(inv.create_time),
    ]),
  ])

  aoaAddSheet(wb, 'New API Keys', [
    ['Key Name', 'User', 'User ID', 'Creation Time'],
    ...data.newKeys.map((key) => [
      safeCell(key.name),
      safeCell(key.username || `#${key.user_id}`),
      key.user_id,
      formatTimestampToDate(key.created_time),
    ]),
  ])

  aoaAddSheet(wb, 'Usage Logs', [
    ['Time', 'User', 'Model', 'Prompt Tokens', 'Completion Tokens', 'Quota'],
    ...data.logs.map((log) => [
      formatTimestampToDate(log.created_at),
      safeCell(log.username),
      safeCell(log.model_name),
      log.prompt_tokens,
      log.completion_tokens,
      log.quota,
    ]),
  ])

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function aoaAddSheet(wb: XLSX.WorkBook, name: string, rows: (string | number)[][]) {
  XLSX.utils.book_append_sheet(wb, aoaToSheet(rows), name)
}
