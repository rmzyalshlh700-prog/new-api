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
import { CreditCard, Gauge, Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Reveal } from './reveal'

const FEATURES = [
  {
    icon: Route,
    titleKey: 'landing.control.routing.title',
    bodyKey: 'landing.control.routing.body',
  },
  {
    icon: Gauge,
    titleKey: 'landing.control.usage.title',
    bodyKey: 'landing.control.usage.body',
  },
  {
    icon: CreditCard,
    titleKey: 'landing.control.payments.title',
    bodyKey: 'landing.control.payments.body',
  },
] as const

export function Control() {
  const { t } = useTranslation()

  return (
    <section
      id='control'
      className='mx-auto w-full max-w-6xl scroll-mt-28 px-5 py-16 sm:px-8 md:py-24'
    >
      <Reveal className='flex max-w-xl flex-col items-start gap-3 text-start'>
        <p className='flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.12em] text-[#6D5DF6] uppercase dark:text-[#A79BFF]'>
          <span className='flex size-6 items-center justify-center rounded-full bg-accent text-[10px] tracking-normal text-primary'>
            {t('landing.control.step')}
          </span>
          {t('landing.control.label')}
        </p>
        <h2 className='overflow-visible py-1 pb-2 text-[1.75rem] leading-[1.45] font-semibold tracking-normal text-balance text-foreground sm:text-4xl'>
          {t('landing.control.title')}
        </h2>
        <p className='text-sm leading-[1.85] text-muted-foreground sm:text-base'>
          {t('landing.control.subtitle')}
        </p>
      </Reveal>

      <div className='mt-12 grid gap-10 text-start md:grid-cols-3 md:gap-8'>
        {FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <Reveal key={feature.titleKey}>
              <article className='flex h-full flex-col gap-3'>
                <span className='flex size-10 items-center justify-center rounded-2xl bg-accent text-primary'>
                  <Icon className='size-4.5' aria-hidden='true' />
                </span>
                <h3 className='pb-0.5 text-base leading-[1.6] font-semibold tracking-normal text-foreground sm:text-[17px]'>
                  {t(feature.titleKey)}
                </h3>
                <p className='text-[13.5px] leading-[1.85] text-muted-foreground'>
                  {t(feature.bodyKey)}
                </p>
              </article>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
