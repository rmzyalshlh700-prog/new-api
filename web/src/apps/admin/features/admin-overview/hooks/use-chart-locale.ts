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

import { useDirection } from '@/shared/components/ui/direction'
import { toIntlLocale } from '@/shared/i18n/languages'

/**
 * Reading direction and BCP-47 locale for the dashboard charts, so axes mirror
 * in right-to-left layouts and tick labels follow the interface language.
 */
export function useChartLocale() {
  const { i18n } = useTranslation()
  const direction = useDirection()

  return {
    isRtl: direction === 'rtl',
    locale: toIntlLocale(i18n.resolvedLanguage || i18n.language),
  }
}
