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
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SummaryTab, LogsTab, PaymentsTab } from './components/archive-tables'
import type { ArchiveRange } from './api'
import { DatePicker } from '@/shared/components/date-picker'
import { Button } from '@/shared/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import { formatDateStr } from '@/shared/lib/format'

export function ArchiveExplorer() {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  // The range is only committed on Apply, so no query runs with a partial
  // filter and tabs never prefetch on mount (range starts null).
  const [range, setRange] = useState<ArchiveRange | null>(null)
  const [tab, setTab] = useState('summaries')

  const handleApply = () => {
    if (!startDate || !endDate) return
    setRange({
      start_date: formatDateStr(startDate),
      end_date: formatDateStr(endDate),
    })
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <span className='text-muted-foreground text-xs'>
            {t('Start date')}
          </span>
          <DatePicker
            selected={startDate}
            onSelect={setStartDate}
            maxDate={endDate}
            placeholder={t('Select date')}
          />
        </div>
        <div className='flex flex-col gap-1'>
          <span className='text-muted-foreground text-xs'>{t('End date')}</span>
          <DatePicker
            selected={endDate}
            onSelect={setEndDate}
            minDate={startDate}
            placeholder={t('Select date')}
          />
        </div>
        <Button
          className='gap-1.5'
          disabled={!startDate || !endDate}
          onClick={handleApply}
        >
          <CalendarDays className='size-4' aria-hidden='true' />
          {t('Apply')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value='summaries'>{t('Daily Summaries')}</TabsTrigger>
          <TabsTrigger value='logs'>{t('Usage Logs')}</TabsTrigger>
          <TabsTrigger value='payments'>{t('Payment Logs')}</TabsTrigger>
        </TabsList>
        <TabsContent value='summaries'>
          <SummaryTab range={range} />
        </TabsContent>
        <TabsContent value='logs'>
          <LogsTab range={range} />
        </TabsContent>
        <TabsContent value='payments'>
          <PaymentsTab range={range} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
