import { useCopilotChatInternal } from '@copilotkit/react-core'
import { useChatContext } from '@copilotkit/react-ui'
import { History, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { useAuthStore } from '@/shared/stores/auth-store'

import {
  adminCopilotHistoryKey,
  historyTitle,
  readAdminCopilotHistory,
  removeAdminCopilotThread,
  toHistoryMessages,
  upsertAdminCopilotThread,
  writeAdminCopilotHistory,
  type AdminCopilotHistoryThread,
} from './admin-copilot-history'

const HEADER_BUTTON_CLASS =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50'

/**
 * Chat header for the Admin Copilot: title on the start edge, then New Chat,
 * History and Close on the end edge. Rendering the controls here keeps them
 * inside the panel, in reading order, and mirrored in Arabic — the library's
 * own close button is absolutely positioned to the physical right edge.
 */
export function AdminCopilotHeader() {
  const { t } = useTranslation()
  const { labels, setOpen } = useChatContext()
  const { messages, setMessages, isLoading } = useCopilotChatInternal()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const storageKey = adminCopilotHistoryKey(userId)
  // The thread being appended to. A ref, not state: persisting must never
  // trigger another render while a run is streaming.
  const activeThreadId = useRef<string | null>(null)
  const [threads, setThreads] = useState<AdminCopilotHistoryThread[]>([])

  // Persist the running transcript after every completed turn.
  useEffect(() => {
    if (isLoading) return
    const historyMessages = toHistoryMessages(messages)
    if (historyMessages.length === 0) return
    const thread: AdminCopilotHistoryThread = {
      id: activeThreadId.current ?? `thread-${Date.now()}`,
      title: historyTitle(historyMessages),
      updatedAt: Date.now(),
      messages: historyMessages,
    }
    activeThreadId.current = thread.id
    writeAdminCopilotHistory(
      storageKey,
      upsertAdminCopilotThread(readAdminCopilotHistory(storageKey), thread)
    )
  }, [isLoading, messages, storageKey])

  const startNewChat = () => {
    activeThreadId.current = null
    setMessages([])
  }

  const loadThread = (thread: AdminCopilotHistoryThread) => {
    activeThreadId.current = thread.id
    setMessages(
      thread.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      }))
    )
  }

  const deleteThread = (id: string) => {
    const remaining = removeAdminCopilotThread(
      readAdminCopilotHistory(storageKey),
      id
    )
    writeAdminCopilotHistory(storageKey, remaining)
    setThreads(remaining)
    if (activeThreadId.current === id) {
      activeThreadId.current = null
    }
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
          disabled={isLoading}
          onClick={startNewChat}
        >
          <Plus className='size-4' aria-hidden='true' />
        </button>

        <DropdownMenu
          onOpenChange={(open) => {
            if (open) setThreads(readAdminCopilotHistory(storageKey))
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
            {threads.length === 0 ? (
              <p className='text-muted-foreground px-2 py-3 text-xs'>
                {t('No saved chats yet')}
              </p>
            ) : (
              threads.map((thread) => (
                <DropdownMenuItem
                  key={thread.id}
                  className='flex items-center justify-between gap-2'
                  onClick={() => {
                    loadThread(thread)
                    setThreads(readAdminCopilotHistory(storageKey))
                  }}
                >
                  <span className='min-w-0 flex-1 truncate'>
                    {thread.title}
                  </span>
                  <button
                    type='button'
                    className='text-muted-foreground hover:text-destructive shrink-0 rounded p-1'
                    aria-label={t('Delete chat')}
                    title={t('Delete chat')}
                    onClick={(event) => {
                      event.stopPropagation()
                      event.preventDefault()
                      deleteThread(thread.id)
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
    </div>
  )
}
