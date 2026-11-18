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
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import type { LandingBrand } from '../brand'
import { Orbit } from './orbit'
import { ProvidersGrid } from './providers-grid'

const TRUST_ITEMS = [
  'landing.hero.trust.openai',
  'landing.hero.trust.billing',
  'landing.hero.trust.simple',
] as const

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: 'easeOut' },
  },
}

export function Hero(props: { brand?: LandingBrand; signedIn?: boolean }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  return (
    <section className='relative'>
      <motion.div
        className='relative mx-auto flex w-full max-w-5xl flex-col items-center px-5 pt-24 pb-10 text-center sm:px-8 sm:pt-28 md:pt-32'
        variants={containerVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? undefined : 'visible'}
      >
        <motion.p
          variants={itemVariants}
          className='inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#6D5DF6] uppercase dark:text-[#A79BFF]'
        >
          <span className='size-1.5 rounded-full bg-[#3B82F6]' aria-hidden='true' />
          {t('landing.hero.eyebrow')}
        </motion.p>

        <motion.h1
          variants={itemVariants}
          className='mt-5 max-w-3xl overflow-visible py-1 text-[2.15rem] leading-[1.35] font-semibold tracking-normal text-balance sm:text-5xl sm:leading-[1.28] md:text-[3.4rem]'
        >
          <span className='block overflow-visible bg-[linear-gradient(270deg,#4f46e5,#7c6bff_45%,#2563eb)] bg-clip-text pb-2 text-transparent'>
            {t('landing.hero.titleTop')}
          </span>
          <span className='block overflow-visible pb-2 text-foreground'>
            {t('landing.hero.titleBottom')}
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className='mt-4 max-w-2xl text-[15px] leading-[1.9] text-pretty text-muted-foreground sm:text-base'
        >
          {t('landing.hero.subtitle')}
        </motion.p>

        <motion.div
          variants={itemVariants}
          className='mt-8 flex w-full flex-col items-center justify-center gap-2.5 sm:w-auto sm:flex-row'
        >
          <Link
            to={props.signedIn ? '/app/workspace' : '/register'}
            className={cn(
              buttonVariants({
                className:
                  'h-11 w-full rounded-full bg-foreground px-6 text-[13.5px] font-semibold text-background shadow-[0_16px_36px_-20px_rgba(15,23,42,0.8)] transition-all duration-200 hover:scale-[1.03] hover:opacity-95 sm:w-auto',
              })
            )}
          >
            {t(
              props.signedIn
                ? 'landing.cta.openConsole'
                : 'landing.hero.primaryCta'
            )}
            <ArrowRight className='size-4 rtl:rotate-180' aria-hidden='true' />
          </Link>
          <Link
            to='/rankings'
            className={cn(
              buttonVariants({
                variant: 'outline',
                className:
                  'h-11 w-full rounded-full border-border bg-card px-6 text-[13.5px] font-medium text-foreground/80 shadow-sm transition-all duration-200 hover:scale-[1.03] hover:bg-muted hover:text-foreground sm:w-auto',
              })
            )}
          >
            {t('landing.hero.secondaryCta')}
          </Link>
        </motion.div>

        <motion.ul
          variants={itemVariants}
          className='mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-muted-foreground'
        >
          {TRUST_ITEMS.map((key) => (
            <li key={key} className='inline-flex items-center gap-1.5'>
              <Check
                className='size-3.5 text-emerald-500'
                strokeWidth={2.6}
                aria-hidden='true'
              />
              {t(key)}
            </li>
          ))}
        </motion.ul>

        <motion.div
          variants={itemVariants}
          className='mt-10 w-full sm:mt-12 md:mt-14'
        >
          <Orbit brand={props.brand} />
        </motion.div>

        <motion.div variants={itemVariants} className='mt-10 w-full sm:mt-12'>
          <ProvidersGrid />
        </motion.div>
      </motion.div>
    </section>
  )
}
