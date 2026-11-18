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

For commercial licensing, please contact contact@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/shared/lib/lobe-icon'

import { LANDING_PROVIDERS } from '../providers'

export function ProvidersGrid() {
  const { t } = useTranslation()

  return (
    <section
      id='models'
      className='mx-auto w-full max-w-2xl scroll-mt-28 px-5 sm:px-0'
    >
      <p className='text-center text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
        {t('landing.models.eyebrow')}
      </p>

      <ul className='mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4'>
        {LANDING_PROVIDERS.map((provider) => (
          <li key={provider.id}>
            <div className='flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm'>
              <span className='flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-card-foreground'>
                {provider.monoOnly ? (
                  getLobeIcon(provider.mono, 18)
                ) : (
                  <>
                    <span className='flex dark:hidden'>
                      {getLobeIcon(provider.icon, 18)}
                    </span>
                    <span className='hidden dark:flex'>
                      {getLobeIcon(provider.mono, 18)}
                    </span>
                  </>
                )}
              </span>
              <span className='truncate text-[12.5px] font-medium text-foreground/80'>
                {provider.name}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
