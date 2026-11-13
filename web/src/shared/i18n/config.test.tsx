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
import { render } from '@testing-library/react'
import { createInstance } from 'i18next'
import { beforeEach, describe, expect, test } from 'vitest'

import { initializeFrontendCache } from '@/shared/lib/frontend-cache'

import { changeInterfaceLanguage, i18nReady, initializeI18n } from './config'

/**
 * Boot-sequence regression tests for the interface language.
 *
 * The app resolves its language once in `initializeI18n` (awaited by
 * `i18nReady`) before React renders. Each boot gets its own i18next instance so
 * a test can simulate a reload, and the assertions check the Arabic
 * *translations*, not only `i18n.language`: i18next reports `ar` while rendering
 * the English source keys when the lazy `ar.json` chunk was never loaded, which
 * is the production bug these tests guard against.
 */
const ARABIC_TRANSLATION = 'معلومات الحساب'

function stubBrowserLanguage(language: string) {
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: language,
  })
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: [language],
  })
}

/** Simulate a full page load: empty storage state aside, boot a fresh i18n. */
async function bootApp() {
  const instance = createInstance()
  await initializeI18n(instance)
  return instance
}

async function renderDirectionProvider() {
  const { DirectionProvider } =
    await import('@/shared/context/direction-provider')
  render(<DirectionProvider>{null}</DirectionProvider>)
}

beforeEach(async () => {
  // The module-level boot settles before a test seeds storage, otherwise its
  // async tail would persist the default language over the seeded choice.
  await i18nReady
  window.localStorage.clear()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('lang')
  stubBrowserLanguage('en-US')
})

describe('interface language boot sequence', () => {
  test('restores the stored Arabic choice and applies RTL', async () => {
    window.localStorage.setItem('i18nextLng', 'ar')
    stubBrowserLanguage('ar')

    const i18n = await bootApp()

    expect(i18n.language).toBe('ar')
    expect(i18n.t('Account Info')).toBe(ARABIC_TRANSLATION)

    await renderDirectionProvider()
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toContain('ar')
  })

  test('auto-detects Arabic from the browser when nothing is stored', async () => {
    stubBrowserLanguage('ar-EG')

    const i18n = await bootApp()

    expect(i18n.language).toBe('ar')
    expect(i18n.t('Account Info')).toBe(ARABIC_TRANSLATION)
    expect(window.localStorage.getItem('i18nextLng')).toBe('ar')
  })

  test('a manual switch to Arabic survives a reload', async () => {
    stubBrowserLanguage('en-US')
    const firstBoot = await bootApp()
    expect(firstBoot.language).toBe('en')

    await changeInterfaceLanguage('ar')
    expect(window.localStorage.getItem('i18nextLng')).toBe('ar')

    // Reload with an English browser: the stored choice must win.
    const secondBoot = await bootApp()
    expect(secondBoot.language).toBe('ar')
    expect(secondBoot.t('Account Info')).toBe(ARABIC_TRANSLATION)

    await renderDirectionProvider()
    expect(document.documentElement.dir).toBe('rtl')
  })

  test('keeps the stored language across a frontend cache-version reset', () => {
    window.localStorage.setItem('i18nextLng', 'ar')
    window.localStorage.setItem('newapi:default:cache-version', 'outdated')
    window.localStorage.setItem('stale-ui-cache', 'old')

    initializeFrontendCache()

    expect(window.localStorage.getItem('i18nextLng')).toBe('ar')
    expect(window.localStorage.getItem('stale-ui-cache')).toBeNull()
  })
})
