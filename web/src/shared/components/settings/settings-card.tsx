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
import { memo } from 'react'

import { ConsoleSectionCard } from '@/shared/components/console'

type SettingsCardProps = {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * One settings section: a single console card with a compact header and one
 * content region. Every settings screen composes this instead of stacking
 * legacy cards, so section titles, dividers and padding never drift between
 * Site, Models, Operations or Security.
 */
export const SettingsCard = memo(function SettingsCard({
  title,
  description,
  children,
  className,
}: SettingsCardProps) {
  return (
    <ConsoleSectionCard
      title={title}
      hint={description}
      className={className}
    >
      {children}
    </ConsoleSectionCard>
  )
})
