import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
import { useRouterState } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '@/shared/lib/http-client'
import { getServerErrorMessage } from '@/shared/lib/server-error-message'
import { useAuthStore } from '@/shared/stores/auth-store'

import type { AdminCopilotToolName } from './admin-copilot-config'

export interface FinancialSummary {
  today: Record<string, number>
  month: Record<string, number>
}

export interface CopilotUser {
  id: number
  username: string
  display_name: string
  email: string
  role: number
  status: number
  group: string
  quota: number
  used_quota: number
  request_count: number
}

export interface SystemHealth {
  cpu_usage: number
  memory_usage: number
  load1: number
  download_bps: number
  upload_bps: number
  latency_ms: number
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

/** Structured failure returned to the assistant instead of a thrown error. */
interface CopilotToolError {
  error: string
}

/**
 * Runs a Copilot tool request and converts every failure into data the model can
 * read. A thrown handler aborts the whole run and reaches the operator as a
 * generic copilot error, so the failure detail would be lost.
 */
async function loadCopilotTool<T>(
  request: Promise<{ data: ApiEnvelope<T> }>,
  fallback: string
): Promise<T | CopilotToolError> {
  try {
    const response = await request
    if (!response.data.success) {
      return { error: getServerErrorMessage(response.data, fallback) }
    }
    return response.data.data
  } catch (error) {
    return { error: getServerErrorMessage(error, fallback) }
  }
}

/**
 * Registers the admin Copilot's frontend tools (financial summary, user
 * lookup, system health) with CopilotKit and publishes the current page as
 * readable context so the assistant knows where the admin is looking.
 */
export function useAdminCopilot(enabledTools: readonly AdminCopilotToolName[]) {
  const { t } = useTranslation()
  // The router owns navigation state. A `popstate` listener never fires for
  // client-side pushState navigations, so the context used to keep describing
  // the page the console was mounted on.
  const pageContext = useRouterState({
    select: (state) => state.location.href,
  })
  const availability = (tool: AdminCopilotToolName) =>
    enabledTools.includes(tool) ? 'enabled' : 'disabled'
  const adminUser = useAuthStore((state) => state.auth.user)

  useCopilotReadable({
    description: t(
      'The admin console page the user is currently viewing, including query parameters'
    ),
    value: pageContext,
  })

  // Who is asking. The tool results are platform-wide, so the model needs the
  // operator's own role and name to answer "what can I do" style questions.
  useCopilotReadable({
    description: t('The signed-in administrator account'),
    value: adminUser
      ? {
          id: adminUser.id,
          username: adminUser.username,
          display_name: adminUser.display_name ?? adminUser.username,
          role: adminUser.role,
          group: adminUser.group,
        }
      : null,
  })

  useCopilotAction({
    name: 'getFinancialSummary',
    description: t(
      'Fetch the platform financial summary: today and this month revenue, cost and profit stats'
    ),
    parameters: [],
    available: availability('getFinancialSummary'),
    handler: async () =>
      loadCopilotTool(
        api.get<ApiEnvelope<FinancialSummary>>(
          '/api/admin/copilot/tools/financials'
        ),
        t('Failed to load the financial summary.')
      ),
  })

  useCopilotAction({
    name: 'lookupUser',
    description: t(
      'Look up platform user details by numeric id, email or username; returns one user or a list of matches'
    ),
    parameters: [
      {
        name: 'id',
        type: 'string',
        description: 'Numeric user id, if known',
        required: false,
      },
      {
        name: 'keyword',
        type: 'string',
        description:
          'Email or username search keyword, used when no id is given',
        required: false,
      },
    ],
    available: availability('lookupUser'),
    handler: async ({ id, keyword }) => {
      const trimmedKeyword = keyword?.trim() ?? ''
      if (!id && !trimmedKeyword) {
        return {
          error: t('Provide a user id, email or username to look up a user.'),
        }
      }
      const params = id ? { id } : { keyword: trimmedKeyword }
      return loadCopilotTool(
        api.get<ApiEnvelope<CopilotUser | CopilotUser[]>>(
          '/api/admin/copilot/tools/users',
          { params }
        ),
        t('Failed to look up the user.')
      )
    },
  })

  useCopilotAction({
    name: 'getSystemHealth',
    description: t(
      'Fetch current server health: CPU usage, memory usage, load average and network throughput'
    ),
    parameters: [],
    available: availability('getSystemHealth'),
    handler: async () =>
      loadCopilotTool(
        api.get<ApiEnvelope<SystemHealth>>('/api/admin/copilot/tools/health'),
        t('Failed to load server health.')
      ),
  })

  const context = useMemo(() => ({ page: pageContext }), [pageContext])
  return context
}
