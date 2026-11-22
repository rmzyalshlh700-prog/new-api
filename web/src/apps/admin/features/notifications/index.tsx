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
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/shared/components/layout'

import { NotificationComposer } from './components/notification-composer'
import { SentNotificationsTable } from './components/sent-notifications-table'

/**
 * Targeted notifications: address one account and only that account receives
 * the message, in its own notification inbox.
 */
export function Notifications() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Notifications')}</SectionPageLayout.Title>
      <SectionPageLayout.Hint>{t('Announcements and inbox delivery.')}</SectionPageLayout.Hint>
      <SectionPageLayout.Content>
        <div className='grid gap-4 xl:grid-cols-2'>
          <NotificationComposer />
          <SentNotificationsTable />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
