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
import { cn } from '@/shared/lib/utils'

import { DEFAULT_LANDING_BRAND, type LandingBrand } from '../brand'

/** Official mark, shipped with the console in `public/logo.png` by default. */
export function AstramuxMark(props: { className?: string; logoUrl?: string }) {
  return (
    <img
      src={props.logoUrl ?? DEFAULT_LANDING_BRAND.logoUrl}
      alt=''
      width={180}
      height={180}
      decoding='async'
      className={cn('size-9 shrink-0 object-contain', props.className)}
    />
  )
}

export function AstramuxLogo(props: {
  className?: string
  brand?: LandingBrand
}) {
  const brand = props.brand ?? DEFAULT_LANDING_BRAND

  return (
    <a
      href='#top'
      className={cn(
        'group/logo flex shrink-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        props.className
      )}
    >
      <AstramuxMark
        logoUrl={brand.logoUrl}
        className='transition-transform duration-300 group-hover/logo:scale-105'
      />
      <span className='max-w-40 truncate text-[15px] leading-none font-semibold tracking-tight text-foreground'>
        {brand.systemName}
      </span>
    </a>
  )
}
