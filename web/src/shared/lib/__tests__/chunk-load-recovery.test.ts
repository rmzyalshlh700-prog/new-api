import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  attemptChunkReload,
  CHUNK_RELOAD_FLAG,
  installChunkLoadRecovery,
  isChunkLoadError,
} from '../chunk-load-recovery'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

const cleanupFns: Array<() => void> = []
afterEach(() => {
  while (cleanupFns.length) cleanupFns.pop()?.()
  vi.restoreAllMocks()
})

/**
 * Dispatches a window `error` event without letting jsdom report it as an
 * uncaught exception when no recovery listener is installed.
 */
function dispatchWindowError(error: unknown) {
  const suppressReport = (event: Event) => event.preventDefault()
  window.addEventListener('error', suppressReport)
  window.dispatchEvent(new ErrorEvent('error', { error, cancelable: true }))
  window.removeEventListener('error', suppressReport)
}

describe('isChunkLoadError', () => {
  it('recognizes webpack and native dynamic import failures', () => {
    expect(
      isChunkLoadError(
        Object.assign(new Error('Loading chunk 42 failed.'), {
          name: 'ChunkLoadError',
        })
      )
    ).toBe(true)
    expect(isChunkLoadError('Loading CSS chunk 42 failed. (/42.css)')).toBe(
      true
    )
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: /static/js/async/42.js'
        )
      )
    ).toBe(true)
    expect(
      isChunkLoadError(new Error('Importing a module script failed.'))
    ).toBe(true)
  })

  it('ignores unrelated errors and empty values', () => {
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError(new Error('Render failed'))).toBe(false)
    expect(isChunkLoadError({ response: { status: 500 } })).toBe(false)
  })
})

describe('attemptChunkReload', () => {
  it('reloads once and blocks the next attempt in the same tab', () => {
    const storage = memoryStorage()
    const reload = vi.fn()

    expect(attemptChunkReload({ storage, reload })).toBe(true)
    expect(storage.getItem(CHUNK_RELOAD_FLAG)).not.toBeNull()

    expect(attemptChunkReload({ storage, reload })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload when the session marker cannot be written', () => {
    const reload = vi.fn()
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage blocked')
      },
      removeItem: () => undefined,
    }

    expect(attemptChunkReload({ storage, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('installChunkLoadRecovery', () => {
  it('reloads on an uncaught chunk error and on a rejected dynamic import', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    cleanupFns.push(installChunkLoadRecovery({ storage, reload }))

    dispatchWindowError(
      Object.assign(new Error('Loading chunk 7 failed.'), {
        name: 'ChunkLoadError',
      })
    )
    expect(reload).toHaveBeenCalledTimes(1)

    // The flag stops a second reload from a rejected import in the same tab.
    const rejection = new Event('unhandledrejection') as Event & {
      reason?: unknown
    }
    rejection.reason = new TypeError(
      'Failed to fetch dynamically imported module: /static/js/async/8.js'
    )
    window.dispatchEvent(rejection)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores unrelated errors', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    cleanupFns.push(installChunkLoadRecovery({ storage, reload }))

    dispatchWindowError(new Error('boom'))
    expect(reload).not.toHaveBeenCalled()
  })

  it('stops listening after the returned cleanup runs', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    const uninstall = installChunkLoadRecovery({ storage, reload })
    uninstall()

    dispatchWindowError(
      Object.assign(new Error('Loading chunk 9 failed.'), {
        name: 'ChunkLoadError',
      })
    )
    expect(reload).not.toHaveBeenCalled()
  })
})
