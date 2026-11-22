/**
 * Client-side transcript storage for the Admin Copilot.
 *
 * Conversations never leave the browser: the runtime is stateless per run, so
 * history lives in `localStorage` keyed per administrator. Only text turns are
 * stored, which keeps the payload small and avoids persisting tool arguments or
 * results that could contain another user's data.
 */

export type AdminCopilotHistoryRole = 'user' | 'assistant'

export interface AdminCopilotHistoryMessage {
  id: string
  role: AdminCopilotHistoryRole
  content: string
}

export interface AdminCopilotHistoryThread {
  id: string
  title: string
  updatedAt: number
  messages: AdminCopilotHistoryMessage[]
}

/** Newest threads kept per administrator; older ones are dropped. */
export const ADMIN_COPILOT_HISTORY_LIMIT = 20

const TITLE_LENGTH = 60

/** Storage key for one administrator, isolated by user id. */
export function adminCopilotHistoryKey(
  userId?: number | string | null
): string {
  return `admin-copilot-history:${userId ?? 'anonymous'}`
}

/** Reads saved threads, discarding anything that is not a shape we wrote. */
export function readAdminCopilotHistory(
  storageKey: string
): AdminCopilotHistoryThread[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const threads: AdminCopilotHistoryThread[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const candidate = item as Partial<AdminCopilotHistoryThread>
      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.title !== 'string' ||
        typeof candidate.updatedAt !== 'number' ||
        !Array.isArray(candidate.messages)
      ) {
        continue
      }
      const messages = candidate.messages.filter(
        (message): message is AdminCopilotHistoryMessage =>
          Boolean(message) &&
          typeof message.id === 'string' &&
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string'
      )
      if (messages.length === 0) continue
      threads.push({
        id: candidate.id,
        title: candidate.title,
        updatedAt: candidate.updatedAt,
        messages,
      })
    }
    return threads
  } catch {
    // Storage can be unavailable (private mode) or hold another tab's garbage.
    return []
  }
}

/** Persists the thread list, ignoring quota or availability failures. */
export function writeAdminCopilotHistory(
  storageKey: string,
  threads: AdminCopilotHistoryThread[]
): void {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(threads.slice(0, ADMIN_COPILOT_HISTORY_LIMIT))
    )
  } catch {
    // A full or blocked store must not break the chat.
  }
}

/** Inserts or replaces a thread, newest first, capped at the limit. */
export function upsertAdminCopilotThread(
  threads: AdminCopilotHistoryThread[],
  thread: AdminCopilotHistoryThread
): AdminCopilotHistoryThread[] {
  return [thread, ...threads.filter((item) => item.id !== thread.id)].slice(
    0,
    ADMIN_COPILOT_HISTORY_LIMIT
  )
}

/** Removes one thread by id. */
export function removeAdminCopilotThread(
  threads: AdminCopilotHistoryThread[],
  id: string
): AdminCopilotHistoryThread[] {
  return threads.filter((thread) => thread.id !== id)
}

/**
 * Extracts the text turns from CopilotKit's message list. Tool calls, results
 * and reasoning messages are skipped so restored transcripts only replay what
 * the operator actually typed or read.
 */
export function toHistoryMessages(
  messages: readonly { id?: unknown; role?: unknown; content?: unknown }[]
): AdminCopilotHistoryMessage[] {
  const history: AdminCopilotHistoryMessage[] = []
  for (const message of messages) {
    const { id, role, content } = message
    if (typeof content !== 'string' || content.trim() === '') continue
    if (role !== 'user' && role !== 'assistant' && role !== 'tool') continue
    history.push({
      id: typeof id === 'string' ? id : `message-${history.length}`,
      role: role === 'assistant' ? 'assistant' : 'user',
      content,
    })
  }
  return history
}

/** Title for the history list: the first user turn, trimmed to one line. */
export function historyTitle(
  messages: readonly AdminCopilotHistoryMessage[]
): string {
  const firstUser = messages.find((message) => message.role === 'user')
  const source = (firstUser ?? messages[0])?.content
    .split(/\s+/)
    .join(' ')
    .trim()
  if (!source) return ''
  return source.length > TITLE_LENGTH
    ? `${source.slice(0, TITLE_LENGTH - 1)}…`
    : source
}
