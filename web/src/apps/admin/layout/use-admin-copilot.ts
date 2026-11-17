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

/** Removes empty entries so a tool never sends a blank filter upstream. */
function cleanParams(
  params: Record<string, string | number | undefined | null>
): Record<string, string | number> {
  const cleaned: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    cleaned[key] = value
  }
  return cleaned
}

/**
 * Registers the admin Copilot's tools with CopilotKit and publishes the current
 * page as readable context so the assistant knows where the admin is looking.
 *
 * Every tool is registered unconditionally and its configuration never
 * changes shape between renders. Both details are load-bearing:
 *
 * - `available: 'disabled'` is not the way to switch a tool off here. In
 *   @copilotkit/react-core 1.87 an action carrying that flag is registered as a
 *   different hook type, so flipping it makes useCopilotAction throw "Action
 *   configuration changed between renders" — and because these tools render
 *   under a null error boundary, that throw silently unmounted the whole
 *   registration and left the assistant with no tools at all.
 * - The permission set is therefore enforced by the server, which trims the
 *   tool list of every run (buildCopilotAguiChatRequest) and refuses each
 *   endpoint of a disabled tool (RequireCopilotTool). The granted names are
 *   published to the agent as context only, so it can say a capability is
 *   switched off rather than invent an answer.
 *
 * Writes go through the same admin handlers the console uses, which record them
 * in the audit log under the signed-in administrator.
 */
export function useAdminCopilot(enabledTools: readonly AdminCopilotToolName[]) {
  const { t } = useTranslation()
  // The router owns navigation state. A `popstate` listener never fires for
  // client-side pushState navigations, so the context used to keep describing
  // the page the console was mounted on.
  const pageContext = useRouterState({
    select: (state) => state.location.href,
  })
  const adminUser = useAuthStore((state) => state.auth.user)

  // The granted set is published to the agent as context, so it can say a
  // capability is switched off instead of quietly answering from memory. The
  // tool list itself is trimmed by the server (see below), which is the only
  // place that decides what the agent may call.
  const enabledToolKey = enabledTools.join(',')
  const grantedTools = useMemo(
    () => new Set(enabledToolKey.split(',')),
    [enabledToolKey]
  )

  useCopilotReadable({
    description: t(
      'The admin console page the user is currently viewing, including query parameters'
    ),
    value: pageContext,
  })

  // Who is asking. The tool results are platform-wide, so the model needs the
  // operator's own role and name to answer "what can I do" style questions.
  // A fresh object per render would re-register this context on every render,
  // because the hook keys on the value's identity; memoize it on the fields.
  const adminUserContext = useMemo(
    () =>
      adminUser
        ? {
            id: adminUser.id,
            username: adminUser.username,
            display_name: adminUser.display_name ?? adminUser.username,
            role: adminUser.role,
            group: adminUser.group,
          }
        : null,
    [adminUser]
  )

  useCopilotReadable({
    description: t('The signed-in administrator account'),
    value: adminUserContext,
  })

  useCopilotReadable({
    description: t(
      'The Copilot capabilities the administrator granted. A capability that is not listed here is switched off and cannot be used.'
    ),
    value: [...grantedTools].sort().join(', '),
  })

  useCopilotAction({
    name: 'getFinancialSummary',
    description: t(
      'Fetch the platform financial summary: today and this month revenue, cost and profit stats'
    ),
    parameters: [],
    handler: async () =>
      loadCopilotTool(
        api.get<ApiEnvelope<FinancialSummary>>(
          '/api/admin/copilot/tools/financials'
        ),
        t('Failed to load the financial summary.')
      ),
  })

  useCopilotAction({
    name: 'getSystemHealth',
    description: t(
      'Fetch current server health: CPU usage, memory usage, load average and network throughput'
    ),
    parameters: [],
    handler: async () =>
      loadCopilotTool(
        api.get<ApiEnvelope<SystemHealth>>('/api/admin/copilot/tools/health'),
        t('Failed to load server health.')
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
    name: 'listUsers',
    description: t(
      'List platform users page by page, optionally filtered by a keyword or a group; returns balances, status and request counts'
    ),
    parameters: [
      {
        name: 'keyword',
        type: 'string',
        description: 'Username or email fragment to filter by',
        required: false,
      },
      {
        name: 'group',
        type: 'string',
        description: 'Group name to filter by',
        required: false,
      },
      {
        name: 'page',
        type: 'number',
        description: 'Page number, starting at 1',
        required: false,
      },
    ],
    handler: async ({ keyword, group, page }) =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ items: CopilotUser[]; total: number }>>(
          '/api/admin/copilot/tools/users/list',
          { params: cleanParams({ keyword, group, page }) }
        ),
        t('Failed to list users.')
      ),
  })

  useCopilotAction({
    name: 'adjustUserQuota',
    description: t(
      'Change a user balance by an amount: a positive quota adds credit and a negative one deducts it. Confirm the amount with the operator before calling this'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric user id',
        required: true,
      },
      {
        name: 'quota',
        type: 'number',
        description: 'Amount to add (positive) or deduct (negative)',
        required: true,
      },
    ],
    handler: async ({ id, quota }) => {
      if (!id || !quota) {
        return { error: t('A user id and a non-zero amount are required.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>('/api/admin/copilot/tools/users/quota', {
          id,
          quota,
        }),
        t('Failed to change the user quota.')
      )
    },
  })

  useCopilotAction({
    name: 'setUserStatus',
    description: t(
      'Enable or disable a user account without deleting it. Confirm with the operator before disabling an account'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric user id',
        required: true,
      },
      {
        name: 'status',
        type: 'string',
        description: 'Either enable or disable',
        required: true,
      },
    ],
    handler: async ({ id, status }) => {
      if (!id) return { error: t('A user id is required.') }
      if (status !== 'enable' && status !== 'disable') {
        return { error: t('status must be enable or disable.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>('/api/admin/copilot/tools/users/status', {
          id,
          status,
        }),
        t('Failed to change the user status.')
      )
    },
  })

  useCopilotAction({
    name: 'listChannels',
    description: t(
      'List upstream channels with status, group and models, optionally filtered by keyword, group, model or status. Upstream keys are never returned'
    ),
    parameters: [
      {
        name: 'keyword',
        type: 'string',
        description: 'Channel name, id or base URL fragment',
        required: false,
      },
      {
        name: 'group',
        type: 'string',
        description: 'Group the channel belongs to',
        required: false,
      },
      {
        name: 'model',
        type: 'string',
        description: 'Only channels that serve this model',
        required: false,
      },
      {
        name: 'status',
        type: 'string',
        description: 'enabled, disabled or auto_disabled',
        required: false,
      },
      {
        name: 'page',
        type: 'number',
        description: 'Page number, starting at 1',
        required: false,
      },
    ],
    handler: async ({ keyword, group, model, status, page }) =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ items: unknown[]; total: number }>>(
          '/api/admin/copilot/tools/channels',
          { params: cleanParams({ keyword, group, model, status, page }) }
        ),
        t('Failed to list channels.')
      ),
  })

  useCopilotAction({
    name: 'getChannel',
    description: t(
      'Read one channel in detail: status, base URL, models, priority, weight and recent test result'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
    ],
    handler: async ({ id }) => {
      if (!id) return { error: t('A channel id is required.') }
      return loadCopilotTool(
        api.get<ApiEnvelope<unknown>>(`/api/admin/copilot/tools/channels/${id}`),
        t('Failed to read the channel.')
      )
    },
  })

  useCopilotAction({
    name: 'createChannel',
    description: t(
      'Add an upstream channel with its key, base URL and models. The channel form validation runs exactly as it does in the console'
    ),
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Channel name shown in the console',
        required: true,
      },
      {
        name: 'type',
        type: 'number',
        description: 'Numeric channel type of the provider',
        required: true,
      },
      {
        name: 'key',
        type: 'string',
        description: 'Upstream API key',
        required: true,
      },
      {
        name: 'models',
        type: 'string',
        description: 'Comma separated model names the channel serves',
        required: true,
      },
      {
        name: 'base_url',
        type: 'string',
        description: 'Upstream base URL, when the provider needs one',
        required: false,
      },
      {
        name: 'group',
        type: 'string',
        description: 'Group the channel belongs to, default is default',
        required: false,
      },
      {
        name: 'priority',
        type: 'number',
        description: 'Routing priority, higher is preferred',
        required: false,
      },
      {
        name: 'weight',
        type: 'number',
        description: 'Routing weight inside the same priority',
        required: false,
      },
    ],
    handler: async ({ name, type, key, models, base_url, group, priority, weight }) =>
      loadCopilotTool(
        api.post<ApiEnvelope<unknown>>('/api/admin/copilot/tools/channels', {
          name,
          type,
          key,
          models,
          ...cleanParams({ base_url, group, priority, weight }),
        }),
        t('Failed to create the channel.')
      ),
  })

  useCopilotAction({
    name: 'updateChannel',
    description: t(
      'Change fields of an existing channel; only the fields given are changed'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
      {
        name: 'name',
        type: 'string',
        description: 'New channel name',
        required: false,
      },
      {
        name: 'base_url',
        type: 'string',
        description: 'New upstream base URL',
        required: false,
      },
      {
        name: 'models',
        type: 'string',
        description: 'New comma separated model list',
        required: false,
      },
      {
        name: 'group',
        type: 'string',
        description: 'New group',
        required: false,
      },
      {
        name: 'priority',
        type: 'number',
        description: 'New routing priority',
        required: false,
      },
      {
        name: 'weight',
        type: 'number',
        description: 'New routing weight',
        required: false,
      },
      {
        name: 'key',
        type: 'string',
        description: 'Replacement upstream API key',
        required: false,
      },
    ],
    handler: async ({ id, ...fields }) => {
      if (!id) return { error: t('A channel id is required.') }
      return loadCopilotTool(
        api.put<ApiEnvelope<unknown>>(
          `/api/admin/copilot/tools/channels/${id}`,
          cleanParams(fields)
        ),
        t('Failed to update the channel.')
      )
    },
  })

  useCopilotAction({
    name: 'setChannelStatus',
    description: t(
      'Enable or disable a channel without deleting it. Confirm with the operator before disabling a channel that is serving traffic'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
      {
        name: 'status',
        type: 'number',
        description: '1 to enable, 2 to disable',
        required: true,
      },
    ],
    handler: async ({ id, status }) => {
      if (!id) return { error: t('A channel id is required.') }
      if (status !== 1 && status !== 2) {
        return { error: t('status must be 1 to enable or 2 to disable.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>(
          `/api/admin/copilot/tools/channels/${id}/status`,
          { status }
        ),
        t('Failed to change the channel status.')
      )
    },
  })

  useCopilotAction({
    name: 'testChannel',
    description: t(
      'Send a real test request through a channel and report the reply, latency and any upstream error'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
      {
        name: 'model',
        type: 'string',
        description: 'Model to test with, when the channel serves several',
        required: false,
      },
    ],
    handler: async ({ id, model }) => {
      if (!id) return { error: t('A channel id is required.') }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>(
          `/api/admin/copilot/tools/channels/${id}/test`,
          {},
          { params: cleanParams({ model }) }
        ),
        t('Failed to test the channel.')
      )
    },
  })

  useCopilotAction({
    name: 'deleteChannel',
    description: t(
      'Delete a channel permanently. Ask the operator to confirm the channel name first; this cannot be undone from the console'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
    ],
    handler: async ({ id }) => {
      if (!id) return { error: t('A channel id is required.') }
      return loadCopilotTool(
        api.delete<ApiEnvelope<unknown>>(
          `/api/admin/copilot/tools/channels/${id}`
        ),
        t('Failed to delete the channel.')
      )
    },
  })

  useCopilotAction({
    name: 'listModels',
    description: t(
      'List every model the channels serve, with how many channels carry it, how many are enabled and which groups use it'
    ),
    parameters: [
      {
        name: 'keyword',
        type: 'string',
        description: 'Model name fragment to filter by',
        required: false,
      },
      {
        name: 'page',
        type: 'number',
        description: 'Page number, starting at 1',
        required: false,
      },
    ],
    handler: async ({ keyword, page }) =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ items: unknown[]; total: number }>>(
          '/api/admin/copilot/tools/models',
          { params: cleanParams({ keyword, page }) }
        ),
        t('Failed to list models.')
      ),
  })

  useCopilotAction({
    name: 'setChannelModels',
    description: t(
      'Add models to or remove models from a channel, or replace its whole model list. Confirm with the operator before removing a model that is serving traffic'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
      {
        name: 'add',
        type: 'string',
        description: 'Comma separated models to add',
        required: false,
      },
      {
        name: 'remove',
        type: 'string',
        description: 'Comma separated models to remove',
        required: false,
      },
      {
        name: 'models',
        type: 'string',
        description: 'Comma separated list that replaces the current models',
        required: false,
      },
    ],
    handler: async ({ id, add, remove, models }) => {
      if (!id) return { error: t('A channel id is required.') }
      const split = (value?: string) =>
        value
          ? value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined
      const body: Record<string, string[]> = {}
      const addList = split(add)
      const removeList = split(remove)
      const replaceList = split(models)
      if (addList) body.add = addList
      if (removeList) body.remove = removeList
      if (replaceList) body.models = replaceList
      if (Object.keys(body).length === 0) {
        return { error: t('Provide models to add, remove or set.') }
      }
      return loadCopilotTool(
        api.put<ApiEnvelope<unknown>>(
          `/api/admin/copilot/tools/channels/${id}/models`,
          body
        ),
        t('Failed to change the channel models.')
      )
    },
  })

  useCopilotAction({
    name: 'searchLogs',
    description: t(
      'Search the usage log of past requests by user, model, channel, group or time range, newest first'
    ),
    parameters: [
      {
        name: 'username',
        type: 'string',
        description: 'Exact username',
        required: false,
      },
      {
        name: 'model',
        type: 'string',
        description: 'Exact model name',
        required: false,
      },
      {
        name: 'channel_id',
        type: 'number',
        description: 'Channel id the request went through',
        required: false,
      },
      {
        name: 'group',
        type: 'string',
        description: 'Group the request was billed to',
        required: false,
      },
      {
        name: 'start_timestamp',
        type: 'number',
        description: 'Unix timestamp, inclusive lower bound',
        required: false,
      },
      {
        name: 'end_timestamp',
        type: 'number',
        description: 'Unix timestamp, inclusive upper bound',
        required: false,
      },
      {
        name: 'page',
        type: 'number',
        description: 'Page number, starting at 1',
        required: false,
      },
    ],
    handler: async (args) =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ items: unknown[]; total: number }>>(
          '/api/admin/copilot/tools/logs',
          { params: cleanParams(args) }
        ),
        t('Failed to search the usage logs.')
      ),
  })

  useCopilotAction({
    name: 'listRedemptions',
    description: t(
      'List generated top-up (redemption) codes with their quota, status and expiry'
    ),
    parameters: [
      {
        name: 'keyword',
        type: 'string',
        description: 'Code name fragment to filter by',
        required: false,
      },
      {
        name: 'status',
        type: 'string',
        description: '1 unused, 2 used, 3 disabled',
        required: false,
      },
      {
        name: 'page',
        type: 'number',
        description: 'Page number, starting at 1',
        required: false,
      },
    ],
    handler: async ({ keyword, status, page }) =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ items: unknown[]; total: number }>>(
          '/api/admin/copilot/tools/redemptions',
          { params: cleanParams({ keyword, status, page }) }
        ),
        t('Failed to list redemption codes.')
      ),
  })

  useCopilotAction({
    name: 'createRedemption',
    description: t(
      'Generate top-up codes for a given quota per code and count. Confirm the amount and the number of codes with the operator before calling this'
    ),
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Short name of the batch, up to 20 characters',
        required: true,
      },
      {
        name: 'quota',
        type: 'number',
        description: 'Credit each code grants',
        required: true,
      },
      {
        name: 'count',
        type: 'number',
        description: 'How many codes to generate, up to 100',
        required: true,
      },
      {
        name: 'expired_time',
        type: 'number',
        description: 'Unix timestamp the codes expire at, 0 for never',
        required: false,
      },
    ],
    handler: async ({ name, quota, count, expired_time }) => {
      if (!name || !quota || !count) {
        return { error: t('A name, a quota and a count are required.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<{ keys: string[]; count: number }>>(
          '/api/admin/copilot/tools/redemptions',
          cleanParams({ name, quota, count, expired_time })
        ),
        t('Failed to generate redemption codes.')
      )
    },
  })


  useCopilotAction({
    name: 'readMonitoring',
    description: t(
      'Read the metrics collection settings: whether it is on, the flush interval, the bucket size and the retention days'
    ),
    parameters: [],
    handler: async () =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ settings: Record<string, string> }>>(
          '/api/admin/copilot/tools/system/monitoring'
        ),
        t('Failed to read the monitoring settings.')
      ),
  })

  useCopilotAction({
    name: 'configureMonitoring',
    description: t(
      'Change one monitoring setting such as perf_metrics_setting.enabled or perf_metrics_setting.retention_days. Confirm the new value with the operator first'
    ),
    parameters: [
      {
        name: 'key',
        type: 'string',
        description: 'Monitoring option key',
        required: true,
      },
      {
        name: 'value',
        type: 'string',
        description: 'New value for that option',
        required: true,
      },
    ],
    handler: async ({ key, value }) => {
      if (!key) return { error: t('A monitoring option key is required.') }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>(
          '/api/admin/copilot/tools/system/monitoring',
          { key, value }
        ),
        t('Failed to change the monitoring settings.')
      )
    },
  })

  useCopilotAction({
    name: 'toggleMaintenanceMode',
    description: t(
      'Put the platform into maintenance mode, or take it out again. While it is on the console and the API are closed to everyone but the whitelist. Always confirm with the operator first'
    ),
    parameters: [
      {
        name: 'enabled',
        type: 'boolean',
        description: 'true enters maintenance mode, false leaves it',
        required: true,
      },
    ],
    handler: async ({ enabled }) =>
      loadCopilotTool(
        api.post<ApiEnvelope<unknown>>(
          '/api/admin/copilot/tools/system/maintenance',
          { enabled }
        ),
        t('Failed to change maintenance mode.')
      ),
  })

  useCopilotAction({
    name: 'createUser',
    description: t(
      'Create a user account with a username, a password and a role. The password is written once and never read back. Confirm the username and role with the operator first'
    ),
    parameters: [
      {
        name: 'username',
        type: 'string',
        description: 'Letters and digits only, up to 20 characters',
        required: true,
      },
      {
        name: 'password',
        type: 'string',
        description: 'Initial password the operator will hand over',
        required: true,
      },
      {
        name: 'display_name',
        type: 'string',
        description: 'Display name shown in the console',
        required: false,
      },
      {
        name: 'role',
        type: 'number',
        description: '1 for a common user, 10 for an administrator',
        required: false,
      },
    ],
    handler: async ({ username, password, display_name, role }) => {
      if (!username || !password) {
        return { error: t('A username and a password are required.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>('/api/admin/copilot/tools/users/create', {
          username,
          password,
          display_name,
          role,
        }),
        t('Failed to create the user.')
      )
    },
  })

  useCopilotAction({
    name: 'deductUserQuota',
    description: t(
      'Take credit away from a user balance. A deduction cannot be undone from the console, so confirm the user and the amount with the operator before calling this'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric user id',
        required: true,
      },
      {
        name: 'quota',
        type: 'number',
        description: 'Positive amount to deduct',
        required: true,
      },
    ],
    handler: async ({ id, quota }) => {
      if (!id || !quota || quota <= 0) {
        return { error: t('A user id and a positive amount are required.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>('/api/admin/copilot/tools/users/deduct', {
          id,
          quota,
        }),
        t('Failed to deduct the user quota.')
      )
    },
  })

  useCopilotAction({
    name: 'readPayments',
    description: t(
      'Page through the top-up and payment records with their trade number, amount and state'
    ),
    parameters: [
      {
        name: 'keyword',
        type: 'string',
        description: 'Trade number or username fragment',
        required: false,
      },
      {
        name: 'page',
        type: 'number',
        description: 'Page number, starting at 1',
        required: false,
      },
    ],
    handler: async (args) =>
      loadCopilotTool(
        api.get<ApiEnvelope<unknown>>('/api/admin/copilot/tools/payments', {
          params: cleanParams(args),
        }),
        t('Failed to read the payment records.')
      ),
  })

  useCopilotAction({
    name: 'updatePaymentGateway',
    description: t(
      'Write one payment gateway setting, such as PayAddress, StripeApiSecret or MinTopUp. A credential is written once and never read back. Confirm the key with the operator first'
    ),
    parameters: [
      {
        name: 'key',
        type: 'string',
        description: 'Payment option key',
        required: true,
      },
      {
        name: 'value',
        type: 'string',
        description: 'New value for that option',
        required: true,
      },
    ],
    handler: async ({ key, value }) => {
      if (!key) return { error: t('A payment option key is required.') }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>(
          '/api/admin/copilot/tools/payments/gateway',
          { key, value }
        ),
        t('Failed to change the payment gateway setting.')
      )
    },
  })

  useCopilotAction({
    name: 'updateGroupRatio',
    description: t(
      'Merge new values into the group ratio table, which changes what every group is billed. Ratios arrives as a JSON object of group name to number. Confirm with the operator first'
    ),
    parameters: [
      {
        name: 'ratios',
        type: 'string',
        description: 'JSON object, for example {"vip": 0.8}',
        required: true,
      },
    ],
    handler: async ({ ratios }) => {
      let parsed: Record<string, number>
      try {
        parsed = JSON.parse(ratios) as Record<string, number>
      } catch {
        return { error: t('ratios must be a JSON object of numbers.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>(
          '/api/admin/copilot/tools/commercial/group-ratio',
          { ratios: parsed }
        ),
        t('Failed to change the group ratios.')
      )
    },
  })

  useCopilotAction({
    name: 'updateModelPricing',
    description: t(
      'Merge new values into the model ratio, completion ratio or fixed price tables. Pass the table you are changing as a JSON object of model name to number, and leave the others empty. Confirm with the operator first'
    ),
    parameters: [
      {
        name: 'model_ratios',
        type: 'string',
        description: 'JSON object of model name to ratio',
        required: false,
      },
      {
        name: 'completion_ratios',
        type: 'string',
        description: 'JSON object of model name to completion ratio',
        required: false,
      },
      {
        name: 'model_prices',
        type: 'string',
        description: 'JSON object of model name to fixed price',
        required: false,
      },
    ],
    handler: async ({ model_ratios, completion_ratios, model_prices }) => {
      const parse = (raw?: string) => {
        if (!raw) return undefined
        try {
          return JSON.parse(raw) as Record<string, number>
        } catch {
          return null
        }
      }
      const body = {
        model_ratios: parse(model_ratios),
        completion_ratios: parse(completion_ratios),
        model_prices: parse(model_prices),
      }
      if (Object.values(body).some((value) => value === null)) {
        return { error: t('Each pricing table must be a JSON object of numbers.') }
      }
      if (Object.values(body).every((value) => value === undefined)) {
        return { error: t('Provide at least one pricing table.') }
      }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>(
          '/api/admin/copilot/tools/commercial/model-pricing',
          body
        ),
        t('Failed to change the model pricing.')
      )
    },
  })

  useCopilotAction({
    name: 'setChannelKey',
    description: t(
      'Write a new upstream key for a channel. The key is write-only: it is never read back and never shown in a reply. Confirm the channel with the operator first'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
      {
        name: 'key',
        type: 'string',
        description: 'New upstream key',
        required: true,
      },
    ],
    handler: async ({ id, key }) => {
      if (!id || !key) {
        return { error: t('A channel id and a key are required.') }
      }
      return loadCopilotTool(
        api.put<ApiEnvelope<unknown>>(
          `/api/admin/copilot/tools/channels/${id}/key`,
          { key }
        ),
        t('Failed to replace the channel key.')
      )
    },
  })

  useCopilotAction({
    name: 'exportLogs',
    description: t(
      'Export the usage log for a filter as CSV, up to a bounded number of rows, for a report'
    ),
    parameters: [
      {
        name: 'username',
        type: 'string',
        description: 'Exact username',
        required: false,
      },
      {
        name: 'model',
        type: 'string',
        description: 'Exact model name',
        required: false,
      },
      {
        name: 'start_timestamp',
        type: 'number',
        description: 'Unix timestamp, inclusive lower bound',
        required: false,
      },
      {
        name: 'end_timestamp',
        type: 'number',
        description: 'Unix timestamp, inclusive upper bound',
        required: false,
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Rows to export, up to 1000',
        required: false,
      },
    ],
    handler: async (args) =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ csv: string; rows: number; total: number }>>(
          '/api/admin/copilot/tools/logs/export',
          { params: cleanParams(args) }
        ),
        t('Failed to export the usage log.')
      ),
  })

  useCopilotAction({
    name: 'listAnnouncements',
    description: t('Read the announcements the console shows to users'),
    parameters: [],
    handler: async () =>
      loadCopilotTool(
        api.get<ApiEnvelope<{ items: unknown[]; total: number }>>(
          '/api/admin/copilot/tools/announcements'
        ),
        t('Failed to read the announcements.')
      ),
  })

  useCopilotAction({
    name: 'publishAnnouncement',
    description: t(
      'Publish an announcement to the console, which every user sees. Confirm the wording with the operator before calling this'
    ),
    parameters: [
      {
        name: 'content',
        type: 'string',
        description: 'Announcement text, up to 500 characters',
        required: true,
      },
      {
        name: 'type',
        type: 'string',
        description: 'default, ongoing, success, warning or error',
        required: false,
      },
      {
        name: 'extra',
        type: 'string',
        description: 'Short optional note, up to 100 characters',
        required: false,
      },
    ],
    handler: async ({ content, type, extra }) => {
      if (!content) return { error: t('Announcement content is required.') }
      return loadCopilotTool(
        api.post<ApiEnvelope<unknown>>('/api/admin/copilot/tools/announcements', {
          content,
          type,
          extra,
        }),
        t('Failed to publish the announcement.')
      )
    },
  })

  const context = useMemo(() => ({ page: pageContext }), [pageContext])
  return context
}
