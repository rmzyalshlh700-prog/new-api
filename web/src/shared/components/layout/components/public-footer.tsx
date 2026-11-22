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

import { usePublicPageVisibility } from '@/shared/features/public-content/visibility'
import { useSystemConfig } from '@/shared/hooks/use-system-config'
import { ASTRAMUX_SUPPORT_URL } from '@/shared/lib/astramux'

const FOOTER_LINK_CLASS =
  'text-muted-foreground hover:text-foreground text-[13px] transition-colors'

type FooterLink = {
  labelKey: string
  to?: string
  href?: string
  visible?: boolean
}

function FooterColumn(props: { title: string; links: FooterLink[] }) {
  const { t } = useTranslation()
  const visibleLinks = props.links.filter((link) => link.visible !== false)

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-[11px] font-semibold tracking-[0.08em] uppercase'>
        {props.title}
      </p>
      <nav className='flex flex-col gap-2.5'>
        {visibleLinks.map((link) => {
          if (link.href) {
            return (
              <a
                key={link.labelKey}
                href={link.href}
                target='_blank'
                rel='noopener noreferrer'
                className={FOOTER_LINK_CLASS}
              >
                {t(link.labelKey)}
              </a>
            )
          }
          return (
            <Link
              key={link.labelKey}
              to={link.to ?? '/'}
              className={FOOTER_LINK_CLASS}
            >
              {t(link.labelKey)}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

/**
 * Footer shared by every public page. Pages an administrator switched off are
 * removed from every column, so a hidden route is never advertised here.
 */
export function PublicFooter() {
  const { t } = useTranslation()
  const { systemName, logo } = useSystemConfig()
  const visibility = usePublicPageVisibility()

  return (
    <footer className='border-border border-t'>
      <div className='mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8'>
        <div className='flex flex-col gap-3'>
          <Link
            to='/'
            className='focus-visible:ring-ring/60 flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2'
          >
            <img
              src={logo}
              alt=''
              width={32}
              height={32}
              decoding='async'
              className='size-8 shrink-0 object-contain'
            />
            <span className='max-w-40 truncate text-[15px] leading-none font-semibold tracking-tight'>
              {systemName}
            </span>
          </Link>
          <p className='text-muted-foreground max-w-[16rem] text-[13px] leading-relaxed'>
            {t('One API for every model, routed by health and priced by use.')}
          </p>
          <a
            href={ASTRAMUX_SUPPORT_URL}
            target='_blank'
            rel='noopener noreferrer'
            className={FOOTER_LINK_CLASS}
          >
            @Astramux_Support
          </a>
        </div>

        <FooterColumn
          title={t('Product')}
          links={[
            { labelKey: 'Models', to: '/rankings' },
            { labelKey: 'Pricing', to: '/pricing' },
            { labelKey: 'Dashboard', to: '/app/workspace' },
          ]}
        />
        <FooterColumn
          title={t('Resources')}
          links={[
            {
              labelKey: 'Documentation',
              to: '/docs',
              visible: visibility.docs,
            },
            {
              labelKey: 'Integrations',
              to: '/integrations',
              visible: visibility.integrations,
            },
            { labelKey: 'Blog', to: '/blog', visible: visibility.blog },
          ]}
        />
        <FooterColumn
          title={t('Company')}
          links={[
            { labelKey: 'About', to: '/about', visible: visibility.about },
            {
              labelKey: 'Support',
              href: ASTRAMUX_SUPPORT_URL,
            },
            { labelKey: 'Privacy', to: '/privacy-policy' },
            { labelKey: 'Terms', to: '/user-agreement' },
          ]}
        />
      </div>

      <div className='border-border text-muted-foreground border-t px-5 py-6 text-center text-[11px] sm:px-8'>
        <bdi>© 2026 Astramux</bdi>
      </div>
    </footer>
  )
}
