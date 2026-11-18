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
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/shared/hooks/use-system-config'

const FOOTER_LINK_CLASS =
  'transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none'

/**
 * Footer shared by every public page. It is fully token-driven so it matches
 * the console in both themes, and every destination is a real route.
 */
export function PublicFooter() {
  const { t } = useTranslation()
  const { systemName, logo } = useSystemConfig()

  return (
    <footer className='border-t border-border'>
      <div className='mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-5 py-12 text-center sm:px-8 md:flex-row md:items-start md:justify-between md:text-start'>
        <div className='flex flex-col items-center gap-3 md:items-start'>
          <Link
            to='/'
            className='flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
          >
            <img
              src={logo}
              alt=''
              width={36}
              height={36}
              decoding='async'
              className='size-9 shrink-0 object-contain'
            />
            <span className='max-w-40 truncate text-[15px] leading-none font-semibold tracking-tight text-foreground'>
              {systemName}
            </span>
          </Link>
          <p className='max-w-xs text-[13px] leading-relaxed text-muted-foreground'>
            {t('landing.footer.tagline')}
          </p>
        </div>

        <nav className='flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px] text-muted-foreground'>
          <Link to='/' hash='quickstart' className={FOOTER_LINK_CLASS}>
            {t('Docs')}
          </Link>
          <Link to='/rankings' className={FOOTER_LINK_CLASS}>
            {t('Models')}
          </Link>
          <Link to='/pricing' className={FOOTER_LINK_CLASS}>
            {t('Pricing')}
          </Link>
          <Link to='/about' className={FOOTER_LINK_CLASS}>
            {t('About')}
          </Link>
          <Link to='/privacy-policy' className={FOOTER_LINK_CLASS}>
            {t('Privacy Policy')}
          </Link>
          <Link to='/user-agreement' className={FOOTER_LINK_CLASS}>
            {t('Terms of Service')}
          </Link>
        </nav>
      </div>

      <div className='border-t border-border px-5 py-6 text-center text-[11px] text-muted-foreground sm:px-8'>
        <bdi>{t('landing.footer.rights', { name: systemName })}</bdi>
      </div>
    </footer>
  )
}
