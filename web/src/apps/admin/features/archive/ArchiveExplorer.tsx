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
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  isValidArchiveRange,
  type ArchiveRange,
  type DailyArchive,
} from './api'
import { ArchiveSummaryCards } from './components/archive-summary-cards'
import { InvoicesTab, UsageLogsTab } from './components/archive-tables'
import { TabErrorBoundary } from './components/tab-error-boundary'
import { DatePicker } from '@/shared/components/date-picker'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { formatDateStr } from '@/shared/lib/format'
import { createServerError } from '@/shared/lib/server-error-message'

const todayRange = (): ArchiveRange => {
  const today = formatDateStr(new Date())
  return { start_date: today, end_date: today }
}

/**
 * The daily financial & operations report: pick a date, see the KPI cards and
 * audit the day's payment invoices and usage. The report view targets one day
 * at a time; the date defaults to today and is applied immediately.
 */
export function ArchiveExplorer() {
  const { t } = useTranslation()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [range, setRange] = useState<ArchiveRange | null>(todayRange())
  const [tab, setTab] = useState('invoices')

  const nextRange: ArchiveRange | null = selectedDate
    ? {
        start_date: formatDateStr(selectedDate),
        end_date: formatDateStr(selectedDate),
      }
    : null
  const canApply = isValidArchiveRange(nextRange)

  const handleApply = () => {
    // Reversed or partial ranges are never committed: the queries stay
    // disabled instead of hammering the API with an invalid time range.
    if (!isValidArchiveRange(nextRange)) return
    setRange(nextRange)
  }

  const { data: summary } = useQuery({
    queryKey: ['archive-summary', range],
    enabled: isValidArchiveRange(range),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { getArchiveSummary } = await import('./api')
      const result = await getArchiveSummary(range as ArchiveRange)
      if (!result.success) {
        throw createServerError(result, t('Failed to load archive'))
      }
      return result.data ?? []
    },
  })
  const daySummary: DailyArchive | null =
    summary && summary.length > 0 ? summary[0] : null

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <Label
            htmlFor='archive-start-date'
            className='text-muted-foreground text-xs font-normal'
          >
            {t('Report date')}
          </Label>
          <DatePicker
            id='archive-start-date'
            selected={selectedDate}
            onSelect={setSelectedDate}
            placeholder={t('Select date')}
          />
        </div>
        <Button className='gap-1.5' disabled={!canApply} onClick={handleApply}>
          <CalendarDays className='size-4' aria-hidden='true' />
          {t('Apply')}
        </Button>
      </div>

      <ArchiveSummaryCards summary={daySummary} loading={false} />

      {/* Each tab panel is isolated: a crash in one tab shows a recoverable
          fallback inside the card instead of blanking the whole page. The
          outer boundary is the last line of defence for the filter bar. */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value='invoices'>{t('Invoices')}</TabsTrigger>
          <TabsTrigger value='logs'>{t('Usage Logs')}</TabsTrigger>
        </TabsList>
        <TabsContent value='invoices'>
          <TabErrorBoundary>
            <InvoicesTab range={range} />
          </TabErrorBoundary>
        </TabsContent>
        <TabsContent value='logs'>
          <TabErrorBoundary>
            <UsageLogsTab range={range} />
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}
