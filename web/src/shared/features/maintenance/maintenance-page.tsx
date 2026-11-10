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
import { Wrench } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { HtmlContent } from '@/shared/components/html-content'
import { useStatus } from '@/shared/hooks/use-status'

export function MaintenancePage() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const customHtml = status?.data?.maintenance_html?.trim() ?? ''
  const systemName = status?.data?.system_name?.trim() ?? ''

  if (customHtml) {
    return (
      <div className='bg-background min-h-svh w-full'>
        <HtmlContent content={customHtml} variant='isolated' />
      </div>
    )
  }

  return (
    <div className='bg-background flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center'>
      <div className='bg-muted flex size-16 items-center justify-center rounded-full'>
        <Wrench aria-hidden='true' className='text-muted-foreground size-8' />
      </div>
      <div className='space-y-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          {t('Maintenance Mode')}
        </h1>
        <p className='text-muted-foreground max-w-md text-sm'>
          {t('System is currently under maintenance. We will be back shortly.')}
        </p>
      </div>
      {systemName ? (
        <p className='text-muted-foreground text-xs'>{systemName}</p>
      ) : null}
    </div>
  )
}
