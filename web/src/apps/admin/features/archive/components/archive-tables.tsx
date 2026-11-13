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
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { usePaymentLogColumns } from '@/apps/admin/features/payment-logs/components/payment-logs-columns'
import { DataTablePage, useDataTable } from '@/shared/components/data-table'
import { Button } from '@/shared/components/ui/button'
import { formatTimestampToDate, formatNumber, formatLogQuota } from '@/shared/lib/format'
import { toIntlLocale } from '@/shared/i18n/languages'
import { createServerError } from '@/shared/lib/server-error-message'

import {
  exportArchiveDay,
  getArchiveLogs,
  getArchivePayments,
  isValidArchiveRange,
  type ArchiveLog,
  type ArchiveRange,
} from '../api'

const PAGE_SIZE = 20

// Shared stable empty array: `query.data?.items ?? []` would allocate a new
// array every render, changing the table's `data` identity and re-triggering
// TanStack's auto-reset → an infinite render loop (tab switch freeze/WSOD).
const EMPTY_ITEMS: never[] = []

type TabProps = { range: ArchiveRange | null }

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
    enabled: isValidArchiveRange(range),
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
      // Preserve the previous reference when nothing changed, otherwise the
      // new object identity alone re-renders the table forever.
      if (
        next.pageIndex === previous.pageIndex &&
        next.pageSize === previous.pageSize
      ) {
        return previous
      }
      return next.pageSize === previous.pageSize
        ? next
        : { ...next, pageIndex: 0 }
    })
  return { query, pagination, onPaginationChange }
}

/**
 * One-day report view: KPI cards above, audit tables below. Export produces a
 * multi-sheet workbook (Summary / Invoices / New API Keys / Usage Logs) built
 * client-side from the structured export endpoint.
 */
export function DayReport(props: TabProps) {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)

  // The whole day's usage logs are fetched once (up to the backend export
  // cap) so the workbook's Usage Logs sheet is complete, not just one page.
  const logsQuery = useQuery({
    queryKey: ['archive-export-logs', props.range],
    enabled: isValidArchiveRange(props.range),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const result = await getArchiveLogs({
        ...(props.range as ArchiveRange),
        p: 1,
        page_size: 100000,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to load archive'))
      }
      return result.data?.items ?? []
    },
  })

  const handleExport = useCallback(async () => {
    if (!isValidArchiveRange(props.range)) return
    setExporting(true)
    try {
      await exportArchiveDay(
        props.range.start_date,
        logsQuery.data ?? EMPTY_ITEMS as ArchiveLog[]
      )
      toast.success(t('Export ready'))
    } catch (error) {
      // Never let an export failure escape the handler: the row stays
      // interactive and the user sees a toast instead of a crash.
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('Failed to export archive')
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }, [props.range, logsQuery.data, t])

  return (
    <div className='space-y-3'>
      <div className='flex justify-end'>
        <Button
          size='sm'
          className='gap-1.5'
          disabled={exporting || logsQuery.isLoading}
          onClick={handleExport}
        >
          <Download className='size-4' aria-hidden='true' />
          {exporting ? t('Exporting…') : t('Export Day Data')}
        </Button>
      </div>
      <InvoicesTab range={props.range} />
      <UsageLogsTab range={props.range} />
    </div>
  )
}

export function InvoicesTab({ range }: TabProps) {
  const { t } = useTranslation()
  const columns = usePaymentLogColumns()
  const { query, pagination, onPaginationChange } = usePagedArchive(
    'archive-payments',
    range,
    getArchivePayments
  )
  const total = query.data?.total ?? 0
  const items = query.data?.items ?? EMPTY_ITEMS
  const { table } = useDataTable({
    data: items,
    columns,
    pagination,
    onPaginationChange,
    manualPagination: true,
    autoResetPageIndex: false,
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

export function UsageLogsTab({ range }: TabProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { query, pagination, onPaginationChange } = usePagedArchive(
    'archive-logs',
    range,
    getArchiveLogs
  )
  const columns = [
    {
      accessorKey: 'created_at',
      header: t('Time'),
      meta: { mobileTitle: true },
      cell: ({ row }: { row: { original: ArchiveLog } }) =>
        formatTimestampToDate(row.original.created_at ?? 0),
    },
    {
      accessorKey: 'username',
      header: t('Username'),
    },
    {
      accessorKey: 'model_name',
      header: t('Model'),
    },
    {
      accessorKey: 'prompt_tokens',
      header: t('Tokens'),
      cell: ({ row }: { row: { original: ArchiveLog } }) =>
        formatNumber(
          (row.original.prompt_tokens ?? 0) +
            (row.original.completion_tokens ?? 0),
          locale
        ),
    },
    {
      accessorKey: 'quota',
      header: t('Quota'),
      cell: ({ row }: { row: { original: ArchiveLog } }) =>
        formatLogQuota(row.original.quota ?? 0),
    },
  ] as ColumnDef<ArchiveLog>[]
  const total = query.data?.total ?? 0
  const items = query.data?.items ?? EMPTY_ITEMS
  const { table } = useDataTable({
    data: items,
    columns,
    pagination,
    onPaginationChange,
    manualPagination: true,
    autoResetPageIndex: false,
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
