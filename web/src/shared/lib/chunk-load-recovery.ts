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

/**
 * Session flag marking an automatic reload already triggered in this tab. It
 * keeps a genuinely offline client (or a missing chunk that still cannot be
 * fetched after reloading) from looping forever.
 */
export const CHUNK_RELOAD_FLAG = 'chunk_reload_attempted'

/**
 * The flag is cleared once the freshly loaded document has been running for a
 * while, so a later deployment can recover again instead of the tab staying
 * permanently suppressed.
 */
const FLAG_RESET_DELAY_MS = 10_000

type ReloadStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface ChunkReloadOptions {
  storage?: ReloadStorage | null
  reload?: () => void
}

function getSessionStorage(): ReloadStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    // Storage can be blocked (private mode, third-party cookie policies).
    return null
  }
}

const CHUNK_MESSAGE_PATTERNS = [
  // webpack / rspack dynamic chunk failures
  /^Loading (CSS )?chunk .+ failed/i,
  /ChunkLoadError/i,
  // Native dynamic import failures after the old asset was removed
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
]

/** True when the value describes a failed JS/CSS chunk download. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name
    if (typeof name === 'string' && name === 'ChunkLoadError') return true
  }
  let message = ''
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  }
  if (!message) return false
  return CHUNK_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * Reloads the document once per tab to pick up the new `index.html` and the
 * chunk hashes it references. Returns `true` when a reload was triggered.
 */
export function attemptChunkReload(options: ChunkReloadOptions = {}): boolean {
  const storage = options.storage ?? getSessionStorage()
  if (!storage) return false
  try {
    if (storage.getItem(CHUNK_RELOAD_FLAG)) return false
    storage.setItem(CHUNK_RELOAD_FLAG, String(Date.now()))
  } catch {
    // Without a persistent marker a reload could loop indefinitely.
    return false
  }
  if (options.reload) {
    options.reload()
  } else if (typeof window !== 'undefined') {
    window.location.reload()
  }
  return true
}

/**
 * Installs document-level recovery for chunk failures that never reach a React
 * error boundary (lazy route preloads, locale chunks, code split dialogs). It
 * listens for both uncaught errors and unhandled promise rejections, because a
 * failed dynamic import surfaces as either one depending on the bundler.
 */
export function installChunkLoadRecovery(
  options: ChunkReloadOptions = {}
): () => void {
  if (typeof window === 'undefined') return () => {}
  const storage = options.storage ?? getSessionStorage()

  const handle = (error: unknown) => {
    if (!isChunkLoadError(error)) return
    attemptChunkReload({ storage, reload: options.reload })
  }
  const onError = (event: ErrorEvent) => handle(event.error ?? event.message)
  const onRejection = (event: PromiseRejectionEvent) => handle(event.reason)

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  // The flag only suppresses the immediate retry of a broken page load; a
  // later deployment in the same tab must still be able to recover.
  const timer = storage
    ? window.setTimeout(() => {
        try {
          storage.removeItem(CHUNK_RELOAD_FLAG)
        } catch {
          /* empty */
        }
      }, FLAG_RESET_DELAY_MS)
    : undefined

  return () => {
    if (timer !== undefined) window.clearTimeout(timer)
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
