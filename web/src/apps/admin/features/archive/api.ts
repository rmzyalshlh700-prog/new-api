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

export interface DailyArchive {
  id: number
  date: string
  total_revenue: number
  total_cost: number
  total_tokens: number
  total_requests: number
  new_users: number
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

export interface ArchiveRange {
  start_date: string
  end_date: string
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

/** Download one day's logs and payments as a CSV file. */
export async function exportArchiveDay(date: string): Promise<void> {
  const response = await api.get('/api/admin/archive/export', {
    params: { date, format: 'csv' },
    responseType: 'blob',
  })
  const blob = response.data as Blob
  // An error page returned as JSON instead of the CSV blob must not produce
  // a corrupted download; surface it as a normal API failure instead.
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Failed to export archive')
  }
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `archive-${date}.csv`
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
