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
import { useQuery } from '@tanstack/react-query'
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { usePaymentLogColumns } from '@/apps/admin/features/payment-logs/components/payment-logs-columns'
import { DataTablePage, useDataTable } from '@/shared/components/data-table'
import { Button } from '@/shared/components/ui/button'
import { toIntlLocale } from '@/shared/i18n/languages'
import {
  formatLogQuota,
  formatNumber,
  formatTimestampToDate,
} from '@/shared/lib/format'
import { createServerError } from '@/shared/lib/server-error-message'

import {
  exportArchiveDay,
  getArchiveLogs,
  getArchivePayments,
  getArchiveSummary,
  type ArchiveLog,
  type ArchiveRange,
  type DailyArchive,
} from '../api'

const PAGE_SIZE = 20

type TabProps = { range: ArchiveRange | null }

export function SummaryTab({ range }: TabProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [exporting, setExporting] = useState<string | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['archive-summary', range],
    enabled: range !== null,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const result = await getArchiveSummary(range as ArchiveRange)
      if (!result.success) {
        throw createServerError(result, t('Failed to load archive'))
      }
      return result.data ?? []
    },
  })

  const handleExport = async (date: string) => {
    setExporting(date)
    try {
      await exportArchiveDay(date)
    } catch (error) {
      // Never let an export failure escape the handler: the row stays
      // interactive and the user sees a toast instead of a crash.
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('Failed to export archive')
      toast.error(message)
    } finally {
      setExporting(null)
    }
  }

  const columns: ColumnDef<DailyArchive>[] = [
    {
      accessorKey: 'date',
      header: t('Date'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-mono tabular-nums'>
          {row.original.date ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'total_revenue',
      header: t('Revenue'),
      cell: ({ row }) => formatLogQuota(row.original.total_revenue ?? 0),
    },
    {
      accessorKey: 'total_cost',
      header: t('Cost'),
      cell: ({ row }) => formatLogQuota(row.original.total_cost ?? 0),
    },
    {
      accessorKey: 'total_tokens',
      header: t('Tokens'),
      cell: ({ row }) =>
        formatNumber(row.original.total_tokens ?? 0, locale),
    },
    {
      accessorKey: 'total_requests',
      header: t('Requests'),
      cell: ({ row }) =>
        formatNumber(row.original.total_requests ?? 0, locale),
    },
    {
      accessorKey: 'new_users',
      header: t('New Users'),
      cell: ({ row }) => formatNumber(row.original.new_users ?? 0, locale),
    },
    {
      accessorKey: 'top_up_amount',
      header: t('Top-up Amount'),
      cell: ({ row }) =>
        formatNumber(row.original.top_up_amount ?? 0, locale),
    },
    {
      id: 'export',
      header: '',
      cell: ({ row }) => (
        <Button
          size='sm'
          className='gap-1.5'
          disabled={
            (exporting !== null && exporting !== row.original.date) ||
            isFetching ||
            isLoading
          }
          onClick={() => handleExport(row.original.date)}
        >
          <Download className='size-4' aria-hidden='true' />
          {exporting === row.original.date
            ? t('Exporting…')
            : t('Export Day Data')}
        </Button>
      ),
    },
  ]

  const { table } = useDataTable({
    data: data ?? [],
    columns,
    enableSorting: false,
    initialPagination: { pageIndex: 0, pageSize: 31 },
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={range !== null && isLoading}
      isFetching={isFetching}
      emptyTitle={t('No archive data')}
      emptyDescription={t('No archived days in the selected range.')}
      skeletonKeyPrefix='archive-summary-skeleton'
    />
  )
}

function usePagedArchive<T>(
  key: string,
  range: ArchiveRange | null,
  fetchPage: (
    params: ArchiveRange & { p: number; page_size: number }
  ) => Promise<{
    success: boolean
    message?: string
    data?: { items: T[]; total: number }
  }>
) {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const query = useQuery({
    queryKey: [key, range, pagination.pageIndex, pagination.pageSize],
    enabled: range !== null,
    placeholderData: (previous) => previous,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const result = await fetchPage({
        ...(range as ArchiveRange),
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to load archive'))
      }
      return { items: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
  })
  const onPaginationChange: OnChangeFn<PaginationState> = (updater) =>
    setPagination((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      return next.pageSize === previous.pageSize
        ? next
        : { ...next, pageIndex: 0 }
    })
  return { query, pagination, onPaginationChange }
}

export function LogsTab({ range }: TabProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { query, pagination, onPaginationChange } = usePagedArchive(
    'archive-logs',
    range,
    getArchiveLogs
  )
  const columns: ColumnDef<ArchiveLog>[] = [
    {
      accessorKey: 'created_at',
      header: t('Time'),
      meta: { mobileTitle: true },
      cell: ({ row }) => formatTimestampToDate(row.original.created_at ?? 0),
    },
    { accessorKey: 'username', header: t('Username') },
    { accessorKey: 'model_name', header: t('Model') },
    {
      accessorKey: 'prompt_tokens',
      header: t('Tokens'),
      cell: ({ row }) =>
        formatNumber(
          (row.original.prompt_tokens ?? 0) +
            (row.original.completion_tokens ?? 0),
          locale
        ),
    },
    {
      accessorKey: 'quota',
      header: t('Quota'),
      cell: ({ row }) => formatLogQuota(row.original.quota ?? 0),
    },
  ]
  const total = query.data?.total ?? 0
  const { table } = useDataTable({
    data: query.data?.items ?? [],
    columns,
    pagination,
    onPaginationChange,
    manualPagination: true,
    enableSorting: false,
    totalCount: total,
  })
  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={range !== null && query.isLoading}
      isFetching={query.isFetching}
      emptyTitle={t('No usage logs')}
      emptyDescription={t('No usage logs in the selected range.')}
      skeletonKeyPrefix='archive-logs-skeleton'
    />
  )
}

export function PaymentsTab({ range }: TabProps) {
  const { t } = useTranslation()
  const columns = usePaymentLogColumns()
  const { query, pagination, onPaginationChange } = usePagedArchive(
    'archive-payments',
    range,
    getArchivePayments
  )
  const total = query.data?.total ?? 0
  const { table } = useDataTable({
    data: query.data?.items ?? [],
    columns,
    pagination,
    onPaginationChange,
    manualPagination: true,
    enableSorting: false,
    totalCount: total,
  })
  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={range !== null && query.isLoading}
      isFetching={query.isFetching}
      emptyTitle={t('No payment records found')}
      emptyDescription={t('No payment records match the current filters.')}
      skeletonKeyPrefix='archive-payments-skeleton'
    />
  )
}
