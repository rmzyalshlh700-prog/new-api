import '@copilotkit/react-ui/styles.css'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import { useRouterState } from '@tanstack/react-router'
import { ChevronsUpDown, MessagesSquare, Send, Sparkles, X } from 'lucide-react'
import {
  Component,
  useCallback,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  getCommonHeaders,
  getFreshAuthHeaders,
} from '@/shared/lib/auth-session'

import {
  ADMIN_COPILOT_DEFAULT_PATH,
  ALL_ADMIN_COPILOT_TOOLS,
  useAdminCopilotRuntimeSettings,
  type AdminCopilotToolName,
} from './admin-copilot-config'
import { useAdminCopilot } from './use-admin-copilot'

interface AdminCopilotProviderProps {
  children: ReactNode
}

interface NullErrorBoundaryProps {
  children: ReactNode
}

interface NullErrorBoundaryState {
  failed: boolean
}

/**
 * Silent isolation boundary: swallows any render crash from the Copilot
 * popup (or the tools registered beneath the CopilotKit context) so a
 * CopilotKit failure can never unmount the admin portal tree again.
 */
class CopilotNullErrorBoundary extends Component<
  NullErrorBoundaryProps,
  NullErrorBoundaryState
> {
  state: NullErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): NullErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[admin] copilot crashed', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.failed) {
      return null
    }
    return this.props.children
  }
}

/**
 * Registers the admin tools and readable context. Must render as a child of
 * <CopilotKit>: Copilot hooks consume the provider's context, so calling
 * them from the component that renders <CopilotKit> itself throws and
 * unmounts the whole React tree.
 */
function AdminCopilotTools({
  enabledTools,
}: {
  enabledTools: AdminCopilotToolName[]
}) {
  useAdminCopilot(enabledTools)
  return null
}

/**
 * Provides the Admin Copilot: registers the frontend admin tools and page
 * context, and mounts the floating chat popup inside the admin layout.
 */
export function AdminCopilotProvider({ children }: AdminCopilotProviderProps) {
  const { t } = useTranslation()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { data: settings } = useAdminCopilotRuntimeSettings()
  // Until the policy loads, advertise the full set: the gateway filters tools
  // against the stored policy server-side, so this cannot widen permissions and
  // it keeps the copilot usable instead of tool-less for the first render.
  const enabledTools = settings?.enabled_tools ?? ALL_ADMIN_COPILOT_TOOLS
  // The bot is hidden outside the dashboard when visibility is dashboard-only,
  // but the admin tree always renders so the rest of the portal keeps working.
  const hideCopilot =
    settings?.visibility === 'dashboard_only' &&
    pathname !== ADMIN_COPILOT_DEFAULT_PATH

  // CopilotKit's TextArea renders a bare <textarea> with no accessible name
  // (only a placeholder, which is not a reliable label). Watch the DOM for the
  // popup's textarea and attach a translated aria-label whenever it mounts.
  useEffect(() => {
    if (hideCopilot) return
    const label = t('Admin Copilot message input')
    const apply = () => {
      document
        .querySelectorAll<HTMLTextAreaElement>(
          '[data-testid="copilot-chat-textarea"]'
        )
        .forEach((textarea) => {
          if (textarea.getAttribute('aria-label') !== label) {
            textarea.setAttribute('aria-label', label)
          }
        })
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [hideCopilot, t])

  // The Copilot bubble is fixed to the bottom-right corner (56px + margin) and
  // floats above page footers, so it covers pagination controls on table pages.
  // Publish its reserved height through a CSS variable that the shared page
  // footer adds to its padding; clearing it on unmount keeps other portals at
  // their natural spacing.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty(
      '--admin-overlay-bottom-size',
      hideCopilot ? '0px' : '72px'
    )
    return () => {
      root.style.setProperty('--admin-overlay-bottom-size', '0px')
    }
  }, [hideCopilot])

  // CopilotKit does not share the app's HTTP client, so its fetch calls would
  // otherwise hit AdminAuth() without a Bearer token and return 401. Forward
  // the current access token on every runtime request, and let CopilotKit
  // re-resolve the headers (with a refresh when the token is about to expire)
  // before each new chat exchange. Never hand CopilotKit an `undefined` header
  // value: its fetch path throws while serializing the request.
  const headers = useCallback(async (): Promise<Record<string, string>> => {
    try {
      return await getFreshAuthHeaders()
    } catch {
      const authorization = getCommonHeaders().Authorization
      return authorization
        ? { 'Content-Type': 'application/json', Authorization: authorization }
        : { 'Content-Type': 'application/json' }
    }
  }, [])

  return (
    <CopilotKit runtimeUrl='/api/admin/copilot/chat' headers={headers}>
      <CopilotNullErrorBoundary>
        {!hideCopilot && <AdminCopilotTools enabledTools={enabledTools} />}
      </CopilotNullErrorBoundary>
      {children}
      {!hideCopilot && (
        <CopilotNullErrorBoundary>
          <CopilotPopup
            defaultOpen={false}
            clickOutsideToClose
            hitEscapeToClose
            labels={{
              title: t('Admin Copilot'),
              placeholder: t('Ask Admin Copilot...'),
              initial: t(
                "Hello! I'm your admin copilot. Ask me about finances, users or system health."
              ),
              error: t('An error occurred. Please try again.'),
              // Chat controls
              regenerateResponse: t('Regenerate response'),
              stopGenerating: t('Stop generating'),
              copyToClipboard: t('Copy to clipboard'),
              copied: t('Copied!'),
              thumbsUp: t('Thumbs up'),
              thumbsDown: t('Thumbs down'),
            }}
            icons={{
              openIcon: <Sparkles className='size-5' />,
              closeIcon: <X className='size-5' />,
              headerCloseIcon: <ChevronsUpDown className='size-5' />,
              sendIcon: <Send className='size-4' />,
              activityIcon: <MessagesSquare className='size-5' />,
            }}
          />
        </CopilotNullErrorBoundary>
      )}
    </CopilotKit>
  )
}
