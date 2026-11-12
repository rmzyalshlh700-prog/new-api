import { useCallback } from 'react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { ChevronsUpDown, MessagesSquare, Send, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/shared/stores/auth-store';
import { getCommonHeaders, getFreshAuthHeaders } from '@/shared/lib/auth-session';
import { useAdminCopilot } from './use-admin-copilot';

interface AdminCopilotProviderProps {
  children: ReactNode;
}

interface NullErrorBoundaryProps {
  children: ReactNode;
}

interface NullErrorBoundaryState {
  failed: boolean;
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
  state: NullErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): NullErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[admin] copilot crashed', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Registers the admin tools and readable context. Must render as a child of
 * <CopilotKit>: Copilot hooks consume the provider's context, so calling
 * them from the component that renders <CopilotKit> itself throws and
 * unmounts the whole React tree.
 */
function AdminCopilotTools() {
  useAdminCopilot();
  return null;
}

/**
 * Provides the Admin Copilot: registers the frontend admin tools and page
 * context, and mounts the floating chat popup inside the admin layout.
 */
export function AdminCopilotProvider({ children }: AdminCopilotProviderProps) {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.auth.accessToken);

  // CopilotKit does not share the app's HTTP client, so its fetch calls would
  // otherwise hit AdminAuth() without a Bearer token and return 401. Forward
  // the current access token on every runtime request, and let CopilotKit
  // re-resolve the headers (with a refresh when the token is about to expire)
  // before each new chat exchange.
  const headers = useCallback(async () => {
    try {
      return await getFreshAuthHeaders();
    } catch {
      const fallback = getCommonHeaders();
      if (!useAuthStore.getState().auth.accessToken) {
        delete fallback.Authorization;
      }
      return fallback;
    }
  }, [accessToken]);

  return (
    <CopilotKit runtimeUrl="/api/admin/copilot/chat" headers={headers}>
      <AdminCopilotTools />
      {children}
      <CopilotNullErrorBoundary>
        <CopilotPopup
          defaultOpen={false}
          clickOutsideToClose
          hitEscapeToClose
          labels={{
            title: t('Admin Copilot'),
            placeholder: t('Ask Admin Copilot...'),
            initial: t(
              "Hello! I'm your admin copilot. Ask me about finances, users or system health.",
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
            openIcon: <Sparkles className="size-5" />,
            closeIcon: <X className="size-5" />,
            headerCloseIcon: <ChevronsUpDown className="size-5" />,
            sendIcon: <Send className="size-4" />,
            activityIcon: <MessagesSquare className="size-5" />,
          }}
        />
      </CopilotNullErrorBoundary>
    </CopilotKit>
  );
}
