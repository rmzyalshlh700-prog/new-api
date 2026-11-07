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
import NumberFlow, { type Format } from '@number-flow/react'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'

export type RollingNumberFormat = Format

export interface RollingNumberProps {
  value: number | null | undefined
  /** NumberFlow formatting options; compact notation keeps wide figures readable. */
  format?: Format
  prefix?: string
  suffix?: string
}

/**
 * Animated figure for the overview KPI tiles: the value sweeps to its next
 * reading instead of snapping. Disabled while the interface asks for reduced
 * motion, which the library also respects on its own.
 */
export function RollingNumber(props: RollingNumberProps) {
  const { i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  if (props.value == null || !Number.isFinite(props.value)) {
    return <>—</>
  }

  return (
    <NumberFlow
      value={props.value}
      locales={locale}
      format={props.format}
      prefix={props.prefix}
      suffix={props.suffix}
    />
  )
}
