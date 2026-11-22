import { api } from '@/shared/lib/http-client'
import { requireServerSuccess } from '@/shared/lib/server-error-message'

import type { ApiEnvelope } from './admin-copilot-config'

/**
 * Saved Admin Copilot conversations.
 *
 * The transcript is stored on the server, owned by the signed-in
 * administrator, so a reload, a cleared browser or another machine restores the
 * same chats. The chat runtime itself stays stateless and still receives the
 * turn list with every run; this module is only how the console reads the list
 * back and writes a finished transcript.
 *
 * Only text turns are stored. Tool calls and their results are never sent here:
 * a result can hold another user's data, and a transcript does not need it to be
 * replayed.
 */
export interface AdminCopilotChat {
  id: number
  title: string
  created_at: number
  updated_at: number
}

export interface AdminCopilotChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// `requireServerSuccess` throws a ServerError for an envelope that reports
// failure, so a 200 carrying `success: false` is not mistaken for an empty list.
function unwrap<T>(response: ApiEnvelope<T>): T {
  return requireServerSuccess(response).data
}

/** Lists the administrator's conversations, newest first. */
export async function listAdminCopilotChats(): Promise<AdminCopilotChat[]> {
  const response = await api.get<ApiEnvelope<AdminCopilotChat[]>>(
    '/api/admin/copilot/chats'
  )
  const chats = unwrap(response.data)
  return Array.isArray(chats) ? chats : []
}

/** Reads one conversation and its turns. */
export async function getAdminCopilotChat(id: number): Promise<{
  chat: AdminCopilotChat
  messages: AdminCopilotChatTurn[]
}> {
  const response = await api.get<
    ApiEnvelope<{ chat: AdminCopilotChat; messages: AdminCopilotChatTurn[] }>
  >(`/api/admin/copilot/chats/${id}`)
  const result = unwrap(response.data)
  return {
    chat: result.chat,
    messages: Array.isArray(result.messages) ? result.messages : [],
  }
}

/** Opens a conversation, optionally with the turns said so far. */
export async function createAdminCopilotChat(input: {
  title?: string
  messages?: AdminCopilotChatTurn[]
}): Promise<AdminCopilotChat> {
  const response = await api.post<ApiEnvelope<AdminCopilotChat>>(
    '/api/admin/copilot/chats',
    input
  )
  return unwrap(response.data)
}

/** Replaces a conversation's stored transcript with the one the console holds. */
export async function saveAdminCopilotChatMessages(
  id: number,
  input: { title?: string; messages: AdminCopilotChatTurn[] }
): Promise<void> {
  const response = await api.put<ApiEnvelope<unknown>>(
    `/api/admin/copilot/chats/${id}/messages`,
    input
  )
  unwrap(response.data)
}

/** Deletes one conversation. */
export async function deleteAdminCopilotChat(id: number): Promise<void> {
  const response = await api.delete<ApiEnvelope<unknown>>(
    `/api/admin/copilot/chats/${id}`
  )
  unwrap(response.data)
}
