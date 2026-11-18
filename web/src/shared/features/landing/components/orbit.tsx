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
import { getLobeIcon } from '@/shared/lib/lobe-icon'
import { cn } from '@/shared/lib/utils'

import type { LandingBrand } from '../brand'
import { LANDING_PROVIDERS, type LandingProvider } from '../providers'
import { AstramuxMark } from './logo'

/** Badge centres sit at 40% of the box, so the outer track is inset by 10%. */
const RADIUS_PERCENT = 40
const STEP_DEGREES = 360 / LANDING_PROVIDERS.length

function orbitPosition(angle: number) {
  const radians = (angle * Math.PI) / 180
  return {
    left: `${50 + RADIUS_PERCENT * Math.sin(radians)}%`,
    top: `${50 - RADIUS_PERCENT * Math.cos(radians)}%`,
  }
}

function ProviderPod(props: { provider: LandingProvider }) {
  const provider = props.provider

  return (
    <div className='group/pod relative'>
      <span
        className={cn(
          'flex size-11 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-sm',
          'transition-[transform,border-color,box-shadow] duration-300 ease-out',
          'group-hover/pod:scale-110 group-hover/pod:border-primary/60 group-hover/pod:shadow-lg group-active/pod:scale-105'
        )}
      >
        {provider.monoOnly ? (
          getLobeIcon(provider.mono, 24)
        ) : (
          <>
            <span className='flex dark:hidden'>{getLobeIcon(provider.icon, 24)}</span>
            <span className='hidden dark:flex'>
              {getLobeIcon(provider.mono, 24)}
            </span>
          </>
        )}
      </span>

      <span className='pointer-events-none absolute inset-x-0 top-[calc(100%+0.45rem)] z-10 flex justify-center opacity-0 transition-opacity duration-200 group-hover/pod:opacity-100 group-active/pod:opacity-100'>
        <span className='rounded-full border border-border bg-foreground px-2 py-0.5 text-[10px] leading-5 font-medium whitespace-nowrap text-background shadow-sm'>
          {provider.name}
        </span>
      </span>
    </div>
  )
}

export function Orbit(props: { brand?: LandingBrand }) {
  const brand = props.brand

  return (
    <div
      className='landing-orbit relative mx-auto aspect-square w-full max-w-[330px] select-none sm:max-w-[440px] md:max-w-[600px]'
      aria-hidden='true'
    >
      <div className='landing-orbit-glow' />

      {/* Two concentric tracks; the outer one traces the pod path exactly. */}
      <div className='absolute inset-[10%] rounded-full border border-border/70' />
      <div className='absolute inset-[26%] rounded-full border border-dashed border-border/70' />

      <div className='landing-orbit-track absolute inset-0'>
        {LANDING_PROVIDERS.map((provider, index) => (
          <div
            key={provider.id}
            className='absolute'
            style={orbitPosition(index * STEP_DEGREES)}
          >
            <div className='-translate-x-1/2 -translate-y-1/2'>
              <div className='landing-orbit-badge'>
                <ProviderPod provider={provider} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
        <div className='relative flex size-32 items-center justify-center rounded-full md:size-40'>
          <div
            className='absolute -inset-2 rounded-full bg-primary/25 blur-xl dark:bg-primary/30'
            aria-hidden='true'
          />
          <div className='absolute inset-0 rounded-full border border-border bg-card shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]' />
          <div className='absolute inset-[13px] rounded-full border border-border/70 md:inset-[16px]' />
          <div className='relative flex max-w-[7rem] flex-col items-center gap-1.5 md:max-w-[8.5rem] md:gap-2'>
            <AstramuxMark
              logoUrl={brand?.logoUrl}
              className='size-10 md:size-12'
            />
            <span className='w-full truncate text-center text-[11px] font-semibold tracking-tight text-foreground md:text-[13px]'>
              {brand?.systemName ?? 'Astramux'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
