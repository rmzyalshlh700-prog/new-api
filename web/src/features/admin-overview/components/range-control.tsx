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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { OVERVIEW_RANGES, type OverviewRangeId } from '../lib/ranges'

const RANGE_LABEL_KEYS: Record<OverviewRangeId, string> = {
  today: 'Today',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

export interface RangeControlProps {
  value: OverviewRangeId
  onChange: (range: OverviewRangeId) => void
  disabled?: boolean
}

/**
 * The overview's window picker. A fixed trigger width keeps the header's
 * other actions from shifting when the window changes.
 */
export function RangeControl(props: RangeControlProps) {
  const { t } = useTranslation()

  return (
    <Select
      value={props.value}
      onValueChange={(value) => props.onChange(value as OverviewRangeId)}
      disabled={props.disabled}
    >
      <SelectTrigger className='w-36' aria-label={t('Select time range')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OVERVIEW_RANGES.map((range) => (
          <SelectItem key={range} value={range}>
            {t(RANGE_LABEL_KEYS[range])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
