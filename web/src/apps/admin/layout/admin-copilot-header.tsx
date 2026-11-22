import { useCopilotChatInternal } from '@copilotkit/react-core'
import { useChatContext } from '@copilotkit/react-ui'
import { History, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

import {
  createAdminCopilotChat,
  deleteAdminCopilotChat,
  getAdminCopilotChat,
  listAdminCopilotChats,
  saveAdminCopilotChatMessages,
  type AdminCopilotChat,
  type AdminCopilotChatTurn,
} from './admin-copilot-chats'
import { historyTitle, toHistoryMessages } from './admin-copilot-history'

const HEADER_BUTTON_CLASS =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50'

/**
 * Reduces CopilotKit's message list to the text turns worth saving.
 *
 * Tool calls, results and reasoning turns are dropped: a result can carry
 * another user's data and none of it is needed to replay the conversation.
 */
function toChatTurns(
  messages: readonly { id?: unknown; role?: unknown; content?: unknown }[]
): AdminCopilotChatTurn[] {
  return toHistoryMessages(messages).map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

/**
 * Chat header for the Admin Copilot: title on the start edge, then New Chat,
 * History and Close on the end edge. Rendering the controls here keeps them
 * inside the panel, in reading order, and mirrored in Arabic — the library's
 * own close button is absolutely positioned to the physical right edge.
 *
 * History lives on the server, keyed to the signed-in administrator, so it
 * survives a reload and follows them to another browser.
 */
export function AdminCopilotHeader() {
  const { t } = useTranslation()
  const { labels, setOpen } = useChatContext()
  const { messages, setMessages, isLoading } = useCopilotChatInternal()
  // The conversation being appended to. A ref, not state: persisting must never
  // trigger another render while a run is streaming.
  const activeChatId = useRef<number | null>(null)
  const [chats, setChats] = useState<AdminCopilotChat[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setChats(await listAdminCopilotChats())
    } catch {
      // A history read is never worth interrupting the chat for.
    }
  }, [])

  // Save the transcript after every finished exchange. The server replaces the
  // stored turns, so a repeated or interrupted save cannot duplicate a turn.
  useEffect(() => {
    if (isLoading) return
    const turns = toChatTurns(messages)
    if (turns.length === 0) return
    const title = historyTitle(toHistoryMessages(messages))
    let abandoned = false
    void (async () => {
      try {
        if (activeChatId.current === null) {
          const chat = await createAdminCopilotChat({ title, messages: turns })
          if (abandoned) return
          activeChatId.current = chat.id
        } else {
          await saveAdminCopilotChatMessages(activeChatId.current, {
            title,
            messages: turns,
          })
        }
        if (!abandoned) await refresh()
      } catch {
        // History is best effort: a failed save must not break the answer.
      }
    })()
    return () => {
      abandoned = true
    }
  }, [isLoading, messages, refresh])

  const startNewChat = () => {
    activeChatId.current = null
    setMessages([])
  }

  const loadChat = async (id: number) => {
    setBusy(true)
    try {
      const stored = await getAdminCopilotChat(id)
      activeChatId.current = stored.chat.id
      setMessages(
        stored.messages.map((message, index) => ({
          id: `stored-${stored.chat.id}-${index}`,
          role: message.role,
          content: message.content,
        }))
      )
    } catch {
      // Leave the current transcript in place if the chat cannot be read.
    } finally {
      setBusy(false)
    }
  }

  const deleteChat = async (id: number) => {
    try {
      await deleteAdminCopilotChat(id)
    } catch {
      return
    }
    if (activeChatId.current === id) {
      activeChatId.current = null
    }
    await refresh()
  }

  return (
    <div className='copilotKitHeader admin-copilot-header'>
      <span className='truncate text-sm font-medium'>{labels.title}</span>
      <div className='copilotKitHeaderControls items-center gap-0.5'>
        <button
          type='button'
          className={HEADER_BUTTON_CLASS}
          aria-label={t('New chat')}
          title={t('New chat')}
          disabled={isLoading || busy}
          onClick={startNewChat}
        >
          <Plus className='size-4' aria-hidden='true' />
        </button>

        <DropdownMenu
          onOpenChange={(open) => {
            if (open) void refresh()
          }}
        >
          <DropdownMenuTrigger
            className={cn(HEADER_BUTTON_CLASS, 'aria-expanded:bg-accent')}
            aria-label={t('Chat history')}
            title={t('Chat history')}
          >
            <History className='size-4' aria-hidden='true' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='max-h-80 w-72'>
            <DropdownMenuLabel>{t('Chat history')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {chats.length === 0 ? (
              <p className='text-muted-foreground px-2 py-3 text-xs'>
                {t('No saved chats yet')}
              </p>
            ) : (
              chats.map((chat) => (
                <DropdownMenuItem
                  key={chat.id}
                  className='flex items-center justify-between gap-2'
                  disabled={busy || isLoading}
                  onClick={() => {
                    void loadChat(chat.id)
                  }}
                >
                  <span className='min-w-0 flex-1 truncate'>{chat.title}</span>
                  <button
                    type='button'
                    className='text-muted-foreground hover:text-destructive shrink-0 rounded p-1'
                    aria-label={t('Delete chat')}
                    title={t('Delete chat')}
                    onClick={(event) => {
                      event.stopPropagation()
                      event.preventDefault()
                      void deleteChat(chat.id)
                    }}
                  >
                    <Trash2 className='size-3.5' aria-hidden='true' />
                  </button>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type='button'
          className={HEADER_BUTTON_CLASS}
          aria-label={t('Close')}
          title={t('Close')}
          onClick={() => setOpen(false)}
        >
          <X className='size-4' aria-hidden='true' />
        </button>
      </div>
      {busy && (
        <Loader2
          className='text-muted-foreground size-3.5 animate-spin'
          aria-hidden='true'
        />
      )}
    </div>
  )
}
