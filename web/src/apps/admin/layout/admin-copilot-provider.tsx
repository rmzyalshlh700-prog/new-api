import type { ReactNode } from 'react';
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { ChevronsUpDown, MessagesSquare, Send, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminCopilot } from './use-admin-copilot';

interface AdminCopilotProviderProps {
  children: ReactNode;
}

/**
 * Provides the Admin Copilot: registers the frontend admin tools and page
 * context, and mounts the floating chat popup inside the admin layout.
 */
export function AdminCopilotProvider({ children }: AdminCopilotProviderProps) {
  const { t } = useTranslation();

  // Register tools + readable context alongside the provider.
  useAdminCopilot();

  return (
    <CopilotKit runtimeUrl="/api/admin/copilot/chat">
      {children}
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
    </CopilotKit>
  );
}
