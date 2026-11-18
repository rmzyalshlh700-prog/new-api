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
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CodePlayground } from './code-playground'
import { Reveal } from './reveal'

export function Connection() {
  const { t } = useTranslation()

  return (
    <section
      id='quickstart'
      className='scroll-mt-28 border-y border-border bg-muted py-16 md:py-24'
    >
      <div className='mx-auto grid w-full max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14'>
        <Reveal className='flex min-w-0 flex-col items-start gap-4'>
          <p className='flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.12em] text-[#6D5DF6] uppercase dark:text-[#A79BFF]'>
            <span className='flex size-6 items-center justify-center rounded-full bg-accent text-[10px] tracking-normal text-primary'>
              {t('landing.connection.step')}
            </span>
            {t('landing.connection.label')}
          </p>
          <h2 className='overflow-visible py-1 pb-2 text-[1.75rem] leading-[1.45] font-semibold tracking-normal text-balance text-foreground sm:text-4xl'>
            {t('landing.connection.title')}
          </h2>
          <p className='max-w-md text-sm leading-[1.85] text-muted-foreground sm:text-base'>
            {t('landing.connection.subtitle')}
          </p>
          <p className='mt-1 inline-flex items-center gap-2 text-[12px] text-muted-foreground'>
            <Check className='size-3.5 text-emerald-500' aria-hidden='true' />
            {t('landing.connection.note')}
          </p>
        </Reveal>

        <Reveal delay={0.1} className='min-w-0'>
          <CodePlayground />
        </Reveal>
      </div>
    </section>
  )
}
