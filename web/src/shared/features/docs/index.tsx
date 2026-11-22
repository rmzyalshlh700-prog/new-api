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
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/shared/components/layout'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { DOCS_NAV, type DocsSectionId } from './sections'

function DocsNavigation(props: {
  activeSection: DocsSectionId
  onNavigate?: () => void
}) {
  const { t } = useTranslation()

  return (
    <nav className='flex flex-col gap-7' aria-label={t('Documentation')}>
      {DOCS_NAV.map((group) => (
        <div key={group.id} className='flex flex-col gap-1'>
          <p className='text-muted-foreground mb-1 px-2 text-[11px] font-semibold tracking-[0.08em] uppercase'>
            {t(group.titleKey)}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon
            const active = item.id === props.activeSection
            return (
              <Link
                key={item.id}
                to='/docs/$section'
                params={{ section: item.id }}
                onClick={props.onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon className='size-4 shrink-0' strokeWidth={1.75} />
                <span className='min-w-0 truncate'>{t(item.labelKey)}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function DocsPage(props: {
  section: DocsSectionId
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <PublicLayout showMainContainer={false}>
      <div className='mx-auto w-full max-w-6xl px-5 pt-24 pb-16 sm:px-6 lg:pt-28'>
        <div className='lg:grid lg:grid-cols-[216px_minmax(0,1fr)] lg:gap-10'>
          <aside className='hidden lg:block'>
            <div className='sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6'>
              <div className='mb-6 px-2'>
                <p className='text-sm font-semibold'>{t('Documentation')}</p>
                <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                  {t('Build on the Astramux API.')}
                </p>
              </div>
              <DocsNavigation activeSection={props.section} />
            </div>
          </aside>

          <div className='min-w-0'>
            <div className='border-border mb-6 flex items-center border-b pb-3 lg:hidden'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='-ms-2 gap-2 text-[13px]'
                onClick={() => setMenuOpen(true)}
                aria-label={t('Open documentation menu')}
              >
                <Menu className='size-4' />
                {t('Menu')}
              </Button>
            </div>

            <article className='min-w-0'>{props.children}</article>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div
          className='fixed inset-0 z-50 flex lg:hidden'
          role='dialog'
          aria-modal='true'
          aria-label={t('Documentation')}
        >
          <div className='bg-background border-border flex h-full w-[86%] max-w-sm flex-col overflow-y-auto border-e px-5 py-5'>
            <div className='mb-5 flex items-start justify-between gap-3'>
              <div>
                <p className='text-base font-semibold'>{t('Documentation')}</p>
                <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                  {t('Build on the Astramux API.')}
                </p>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                onClick={() => setMenuOpen(false)}
                aria-label={t('Close menu')}
              >
                <X className='size-4' />
              </Button>
            </div>
            <DocsNavigation
              activeSection={props.section}
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
          <button
            type='button'
            aria-label={t('Close menu')}
            className='flex-1 bg-black/40'
            onClick={() => setMenuOpen(false)}
          />
        </div>
      )}
    </PublicLayout>
  )
}

export {
  DocsCard,
  DocsCallout,
  DocsCodeBlock,
  DocsList,
  DocsParagraph,
  DocsSectionTitle,
} from './components'
