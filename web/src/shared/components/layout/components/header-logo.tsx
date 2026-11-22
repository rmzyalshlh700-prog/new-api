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

interface HeaderLogoProps {
  src: string
  alt?: string
  className?: string
}

/**
 * Logo for the public header. It renders on the first frame at a fixed size:
 * the container reserves the box, so the image never waits behind an
 * `opacity-0` preload gate and never shifts layout.
 */
export function HeaderLogo(props: HeaderLogoProps) {
  return (
    <img
      src={props.src}
      alt={props.alt ?? 'logo'}
      width={28}
      height={28}
      decoding='async'
      fetchPriority='high'
      className={cn('h-6 w-6 rounded-full', props.className)}
    />
  )
}
