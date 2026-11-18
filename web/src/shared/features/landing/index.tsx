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
import { useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/shared/components/layout'
import {
  getInterfaceLanguageDirection,
  normalizeInterfaceLanguage,
} from '@/shared/i18n/languages'
import { useAuthStore } from '@/shared/stores/auth-store'

import { DEFAULT_LANDING_BRAND, type LandingBrand } from './brand'
import { BottomCta } from './components/bottom-cta'
import { Connection } from './components/connection'
import { Control } from './components/control'
import { Hero } from './components/hero'
import './landing.css'

/** Brand values a host app such as astramux-core can pass in. */
export type LandingPageProps = {
  systemName?: string
  logoUrl?: string
}

export function LandingPage(props: LandingPageProps = {}) {
  const { i18n } = useTranslation()
  const signedIn = useAuthStore((state) => !!state.auth.user)
  const language = i18n.resolvedLanguage || i18n.language
  const dir = getInterfaceLanguageDirection(language)
  const lang = normalizeInterfaceLanguage(language)

  // The document owns direction for scrollbars, sticky elements and anchor
  // offsets; the page root repeats it so nested `rtl:` utilities resolve even
  // when the landing page is rendered below another layout.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', lang)
  }, [dir, lang])

  const brand: LandingBrand = {
    systemName: props.systemName?.trim() || DEFAULT_LANDING_BRAND.systemName,
    logoUrl: props.logoUrl?.trim() || DEFAULT_LANDING_BRAND.logoUrl,
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div
        id='top'
        dir={dir}
        lang={lang}
        className='landing-root relative isolate flex-1 overflow-x-clip bg-background text-foreground'
      >
        <div
          className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] overflow-hidden'
          aria-hidden='true'
        >
          <div className='landing-glow' />
          <div className='landing-grid-bg' />
        </div>

        <main>
          <Hero brand={brand} signedIn={signedIn} />
          <Connection />
          <Control />
          <BottomCta signedIn={signedIn} />
        </main>
      </div>
    </PublicLayout>
  )
}
