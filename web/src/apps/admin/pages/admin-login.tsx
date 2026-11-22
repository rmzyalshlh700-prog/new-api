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
import { useNavigate } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ConsoleSectionCard } from '@/shared/components/console'
import { UserAuthForm } from '@/shared/features/auth/sign-in/components/user-auth-form'
import { LanguageSwitcher } from '@/shared/components/language-switcher'
import { useStatus } from '@/shared/hooks/use-status'
import { useSystemConfig } from '@/shared/hooks/use-system-config'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Administrator sign-in.
 *
 * A single centred card on a quiet canvas: brand above, credentials in the
 * middle, the audit notice below. The hardened credential form is reused in
 * `credentialsOnly` mode, so no OAuth provider, Passkey, WeChat or
 * registration entry point is reachable here. `requiredRole` revokes the fresh
 * session of an account below the Admin role instead of forwarding it to the
 * client portal; the RBAC decision is still enforced by `requireAdminAccess`
 * on every admin route.
 */
export function AdminLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.auth.user?.role)
  const bootstrapState = useAuthStore((state) => state.auth.bootstrapState)
  const { status } = useStatus()
  const { logo } = useSystemConfig()
  const siteName = status?.system_name || 'Astramux'

  useEffect(() => {
    // Forward only a positively resolved session. A stale user kept in memory
    // across a transient refresh failure must not ping-pong with the admin
    // route guard, which sends unresolved sessions back to this page.
    if (
      bootstrapState === 'complete' &&
      role !== undefined &&
      role >= ROLE.ADMIN
    ) {
      void navigate({ to: '/admin/overview', replace: true })
    }
  }, [bootstrapState, navigate, role])

  return (
    <div className='bg-console-panel text-console-ink relative flex min-h-svh flex-col items-center justify-center px-4 py-10'>
      {/* Quiet dotted field: gives the card a surface to sit on without a
          gradient or an illustration competing with the form. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(var(--console-line-strong)_1px,transparent_1px)] [background-size:22px_22px]'
      />

      <div className='absolute end-3 top-3 z-10'>
        <LanguageSwitcher />
      </div>

      <main className='relative z-1 w-full max-w-[24rem]'>
        <div className='mb-6 flex flex-col items-center gap-3 text-center'>
          <span className='border-console-line bg-console-surface shadow-console-card flex size-14 items-center justify-center overflow-hidden rounded-2xl border'>
            <img
              src={logo || '/logo.png'}
              alt={t('Logo')}
              width={40}
              height={40}
              className='size-10 object-contain'
            />
          </span>
          <div className='space-y-1'>
            <h1 className='text-console-ink text-lg font-semibold tracking-tight'>
              {siteName}
            </h1>
            <p className='text-console-ink-3 text-xs'>{t('Admin console')}</p>
          </div>
        </div>

        <ConsoleSectionCard
          title={t('Admin sign in')}
          hint={t('Use an administrator or root account to continue.')}
          className='shadow-console-pop gap-0'
          contentClassName='px-5 py-4 sm:px-6 sm:py-5'
        >
          <UserAuthForm
            redirectTo='/admin/overview'
            credentialsOnly
            requiredRole={ROLE.ADMIN}
          />
        </ConsoleSectionCard>

        <p className='text-console-ink-3 mt-4 flex items-start justify-center gap-1.5 px-2 text-center text-xs leading-relaxed'>
          <ShieldCheck className='mt-0.5 size-3.5 shrink-0' aria-hidden='true' />
          <span>
            {t(
              'Administrators only. Every administrative action is audited.'
            )}
          </span>
        </p>
      </main>
    </div>
  )
}
