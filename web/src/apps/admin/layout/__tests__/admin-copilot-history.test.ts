import { beforeEach, describe, expect, it } from 'vitest'

import {
  ADMIN_COPILOT_HISTORY_LIMIT,
  adminCopilotHistoryKey,
  historyTitle,
  readAdminCopilotHistory,
  removeAdminCopilotThread,
  toHistoryMessages,
  upsertAdminCopilotThread,
  writeAdminCopilotHistory,
  type AdminCopilotHistoryThread,
} from '../admin-copilot-history'

function thread(id: string, content = 'hello'): AdminCopilotHistoryThread {
  return {
    id,
    title: content,
    updatedAt: 1,
    messages: [{ id: `${id}-m`, role: 'user', content }],
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('admin copilot history store', () => {
  it('isolates transcripts per administrator', () => {
    expect(adminCopilotHistoryKey(7)).not.toBe(adminCopilotHistoryKey(8))
    expect(adminCopilotHistoryKey(undefined)).toBe(
      'admin-copilot-history:anonymous'
    )
  })

  it('round-trips threads through storage', () => {
    const key = adminCopilotHistoryKey(1)
    writeAdminCopilotHistory(key, [thread('a')])

    expect(readAdminCopilotHistory(key)).toEqual([thread('a')])
  })

  it('ignores corrupted and foreign payloads', () => {
    const key = adminCopilotHistoryKey(1)
    window.localStorage.setItem(key, 'not json')
    expect(readAdminCopilotHistory(key)).toEqual([])

    window.localStorage.setItem(key, JSON.stringify([{ id: 1 }, null]))
    expect(readAdminCopilotHistory(key)).toEqual([])
  })

  it('moves an updated thread to the front without duplicating it', () => {
    const threads = upsertAdminCopilotThread(
      [thread('a'), thread('b')],
      thread('a', 'updated')
    )

    expect(threads.map((item) => item.id)).toEqual(['a', 'b'])
    expect(threads[0].messages[0].content).toBe('updated')
  })

  it('caps stored threads at the limit', () => {
    let threads: AdminCopilotHistoryThread[] = []
    for (let index = 0; index < ADMIN_COPILOT_HISTORY_LIMIT + 5; index += 1) {
      threads = upsertAdminCopilotThread(threads, thread(`t${index}`))
    }

    expect(threads).toHaveLength(ADMIN_COPILOT_HISTORY_LIMIT)
    expect(threads[0].id).toBe(`t${ADMIN_COPILOT_HISTORY_LIMIT + 4}`)
  })

  it('removes a single thread', () => {
    expect(
      removeAdminCopilotThread([thread('a'), thread('b')], 'a').map(
        (item) => item.id
      )
    ).toEqual(['b'])
  })

  it('keeps only text turns when extracting a transcript', () => {
    const messages = toHistoryMessages([
      { id: '1', role: 'user', content: 'How many users?' },
      { id: '2', role: 'assistant', content: '  ' },
      { id: '3', role: 'assistant', content: 'Four users.' },
      { id: '4', role: 'tool', content: '{"total":4}' },
    ])

    expect(messages).toEqual([
      { id: '1', role: 'user', content: 'How many users?' },
      { id: '3', role: 'assistant', content: 'Four users.' },
      { id: '4', role: 'user', content: '{"total":4}' },
    ])
  })

  it('titles a thread from its first user turn', () => {
    expect(
      historyTitle([
        { id: '1', role: 'assistant', content: 'Hello' },
        { id: '2', role: 'user', content: '  Revenue today?  ' },
      ])
    ).toBe('Revenue today?')
    expect(
      historyTitle([{ id: '1', role: 'user', content: 'x'.repeat(80) }])
    ).toHaveLength(60)
  })
})
