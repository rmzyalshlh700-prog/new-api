import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/lib/http-client'
import { requireServerSuccess } from '@/shared/lib/server-error-message'

/**
 * The Copilot's capability catalogue.
 *
 * A tool is the unit of permission. The server publishes the same list (its
 * own catalogue is the authority for what may be enabled and for refusing a
 * disabled tool), and this file adds the labels the console shows. Grouping by
 * admin area lets an operator grant a whole area at once, and the risk level
 * tells them which switches can change or destroy data.
 */
export type AdminCopilotToolName =
  | 'getFinancialSummary'
  | 'lookupUser'
  | 'listUsers'
  | 'adjustUserQuota'
  | 'setUserStatus'
  | 'listChannels'
  | 'getChannel'
  | 'createChannel'
  | 'updateChannel'
  | 'setChannelStatus'
  | 'testChannel'
  | 'deleteChannel'
  | 'listModels'
  | 'setChannelModels'
  | 'searchLogs'
  | 'listRedemptions'
  | 'createRedemption'
  | 'getSystemHealth'

export type AdminCopilotToolGroup =
  | 'financials'
  | 'users'
  | 'channels'
  | 'models'
  | 'logs'
  | 'redemptions'
  | 'system'

export type AdminCopilotToolRisk = 'read' | 'write' | 'destructive'

export interface AdminCopilotToolDefinition {
  name: AdminCopilotToolName
  group: AdminCopilotToolGroup
  risk: AdminCopilotToolRisk
  labelKey: string
  descriptionKey: string
}

export interface AdminCopilotToolGroupDefinition {
  key: AdminCopilotToolGroup
  labelKey: string
  descriptionKey: string
}

export const ADMIN_COPILOT_TOOL_GROUPS: readonly AdminCopilotToolGroupDefinition[] =
  [
    {
      key: 'financials',
      labelKey: 'Financial summary',
      descriptionKey: 'Revenue, cost and profit the platform reports.',
    },
    {
      key: 'users',
      labelKey: 'Users and balance',
      descriptionKey:
        'Finding users, reading their balance, adjusting quota and enabling or disabling accounts.',
    },
    {
      key: 'channels',
      labelKey: 'Channels',
      descriptionKey:
        'Listing, inspecting, creating, editing, testing, disabling and deleting upstream channels.',
    },
    {
      key: 'models',
      labelKey: 'Models',
      descriptionKey:
        'The model catalogue and the models each channel offers.',
    },
    {
      key: 'logs',
      labelKey: 'Usage logs',
      descriptionKey: 'Searching the usage log of past requests.',
    },
    {
      key: 'redemptions',
      labelKey: 'Redemption codes',
      descriptionKey: 'Reading and generating top-up codes.',
    },
    {
      key: 'system',
      labelKey: 'System health',
      descriptionKey: 'CPU, memory, load average and network throughput.',
    },
  ]

export const ADMIN_COPILOT_TOOLS: readonly AdminCopilotToolDefinition[] = [
  {
    name: 'getFinancialSummary',
    group: 'financials',
    risk: 'read',
    labelKey: 'Allow Financial Analysis',
    descriptionKey:
      'Lets the copilot read today and this month revenue, cost and profit stats.',
  },
  {
    name: 'lookupUser',
    group: 'users',
    risk: 'read',
    labelKey: 'Allow User Lookup',
    descriptionKey:
      'Lets the copilot search users by id, email or username and read their quota and status.',
  },
  {
    name: 'listUsers',
    group: 'users',
    risk: 'read',
    labelKey: 'Allow listing users',
    descriptionKey:
      'Lets the copilot page through the user list, filtered by keyword or group.',
  },
  {
    name: 'adjustUserQuota',
    group: 'users',
    risk: 'write',
    labelKey: 'Allow adjusting user quota',
    descriptionKey:
      'Lets the copilot add to or subtract from a user balance. Every change is recorded in the audit log under the signed-in administrator.',
  },
  {
    name: 'setUserStatus',
    group: 'users',
    risk: 'write',
    labelKey: 'Allow enabling and disabling users',
    descriptionKey:
      'Lets the copilot disable or re-enable an account without deleting it.',
  },
  {
    name: 'listChannels',
    group: 'channels',
    risk: 'read',
    labelKey: 'Allow listing channels',
    descriptionKey:
      'Lets the copilot read channels with their status, group and model list. Upstream keys are never included.',
  },
  {
    name: 'getChannel',
    group: 'channels',
    risk: 'read',
    labelKey: 'Allow reading one channel',
    descriptionKey:
      'Lets the copilot inspect a single channel: status, base URL, models, priority and weight.',
  },
  {
    name: 'createChannel',
    group: 'channels',
    risk: 'write',
    labelKey: 'Allow adding channels',
    descriptionKey:
      'Lets the copilot add a channel with its key, base URL and models, using the same validation as the channel form.',
  },
  {
    name: 'updateChannel',
    group: 'channels',
    risk: 'write',
    labelKey: 'Allow editing channels',
    descriptionKey:
      'Lets the copilot change fields of an existing channel, such as its name, base URL, models, priority or weight.',
  },
  {
    name: 'setChannelStatus',
    group: 'channels',
    risk: 'write',
    labelKey: 'Allow enabling and disabling channels',
    descriptionKey:
      'Lets the copilot switch a channel on or off without deleting it.',
  },
  {
    name: 'testChannel',
    group: 'channels',
    risk: 'write',
    labelKey: 'Allow testing channels',
    descriptionKey:
      'Lets the copilot send a real test request through a channel and report the reply, latency and any error.',
  },
  {
    name: 'deleteChannel',
    group: 'channels',
    risk: 'destructive',
    labelKey: 'Allow deleting channels',
    descriptionKey:
      'Lets the copilot delete a channel. The channel and its configuration are removed and cannot be restored from the console.',
  },
  {
    name: 'listModels',
    group: 'models',
    risk: 'read',
    labelKey: 'Allow listing models',
    descriptionKey:
      'Lets the copilot read every model the channels serve, with how many channels carry it and whether they are enabled.',
  },
  {
    name: 'setChannelModels',
    group: 'models',
    risk: 'write',
    labelKey: 'Allow changing the models of a channel',
    descriptionKey:
      'Lets the copilot add models to or remove models from a channel, which changes what that channel serves.',
  },
  {
    name: 'searchLogs',
    group: 'logs',
    risk: 'read',
    labelKey: 'Allow searching usage logs',
    descriptionKey:
      'Lets the copilot search past requests by user, model, channel, group or time range.',
  },
  {
    name: 'listRedemptions',
    group: 'redemptions',
    risk: 'read',
    labelKey: 'Allow listing redemption codes',
    descriptionKey:
      'Lets the copilot read generated top-up codes and their status.',
  },
  {
    name: 'createRedemption',
    group: 'redemptions',
    risk: 'write',
    labelKey: 'Allow generating redemption codes',
    descriptionKey:
      'Lets the copilot generate top-up codes for a given quota and count.',
  },
  {
    name: 'getSystemHealth',
    group: 'system',
    risk: 'read',
    labelKey: 'Allow System Health Check',
    descriptionKey:
      'Lets the copilot read CPU, memory, load average and network throughput.',
  },
]

export const ALL_ADMIN_COPILOT_TOOLS: AdminCopilotToolName[] =
  ADMIN_COPILOT_TOOLS.map((tool) => tool.name)

/** Tools that only read platform data: a safe baseline for a new operator. */
export const ADMIN_COPILOT_READ_ONLY_TOOLS: AdminCopilotToolName[] =
  ADMIN_COPILOT_TOOLS.filter((tool) => tool.risk === 'read').map(
    (tool) => tool.name
  )

/** Tools a click cannot undo, shown with the strongest warning. */
export const ADMIN_COPILOT_DESTRUCTIVE_TOOLS: AdminCopilotToolName[] =
  ADMIN_COPILOT_TOOLS.filter((tool) => tool.risk === 'destructive').map(
    (tool) => tool.name
  )

export function adminCopilotToolsInGroup(
  group: AdminCopilotToolGroup
): AdminCopilotToolDefinition[] {
  return ADMIN_COPILOT_TOOLS.filter((tool) => tool.group === group)
}

export function isAdminCopilotToolName(
  name: string
): name is AdminCopilotToolName {
  return ADMIN_COPILOT_TOOLS.some((tool) => tool.name === name)
}

/**
 * Keeps the known tools only, in catalogue order. A stored permission set can
 * carry a name this console no longer knows (an older or newer server), and
 * passing it on unchecked would make the save fail every time.
 */
export function normalizeAdminCopilotTools(
  names: readonly string[]
): AdminCopilotToolName[] {
  const requested = new Set(names)
  return ADMIN_COPILOT_TOOLS.filter((tool) => requested.has(tool.name)).map(
    (tool) => tool.name
  )
}

export type AdminCopilotVisibility = 'all' | 'dashboard_only'

export interface AdminCopilotSettings {
  base_url: string
  model: string
  stream: boolean
  enabled_tools: AdminCopilotToolName[]
  visibility: AdminCopilotVisibility
  api_key_configured: boolean
}

export interface UpdateAdminCopilotSettingsRequest {
  base_url: string
  api_key?: string
  clear_api_key?: boolean
  model: string
  stream?: boolean
  enabled_tools: AdminCopilotToolName[]
  visibility: AdminCopilotVisibility
}

export interface AdminCopilotModelsRequest {
  base_url: string
  api_key?: string
}

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export const ADMIN_COPILOT_DEFAULT_PATH = '/admin/overview'

export const ADMIN_COPILOT_SETTINGS_QUERY_KEY = ['admin-copilot-settings']
export const ADMIN_COPILOT_RUNTIME_QUERY_KEY = ['admin-copilot-runtime']

export interface AdminCopilotRuntimeSettings {
  enabled_tools: AdminCopilotToolName[]
  visibility: AdminCopilotVisibility
}

export const defaultAdminCopilotSettings: AdminCopilotSettings = {
  base_url: '',
  model: '',
  stream: false,
  enabled_tools: ALL_ADMIN_COPILOT_TOOLS,
  visibility: 'all',
  api_key_configured: false,
}

/** Shared cache entry for the Copilot settings used by the runtime and the settings page. */
export function useAdminCopilotSettings() {
  return useQuery({
    queryKey: ADMIN_COPILOT_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<AdminCopilotSettings>>(
        '/api/admin/system-settings/copilot'
      )
      const result = requireServerSuccess(response.data)
      return {
        ...defaultAdminCopilotSettings,
        ...result.data,
        enabled_tools: Array.isArray(result.data?.enabled_tools)
          ? normalizeAdminCopilotTools(result.data.enabled_tools)
          : ALL_ADMIN_COPILOT_TOOLS,
      }
    },
    staleTime: 60_000,
  })
}

/**
 * Runtime policy for every admin, including those not allowed into system
 * settings. The full settings endpoint is restricted, so the chat runtime
 * reads this sanitized subset instead of losing all tools for those admins.
 */
export function useAdminCopilotRuntimeSettings() {
  return useQuery({
    queryKey: ADMIN_COPILOT_RUNTIME_QUERY_KEY,
    queryFn: async (): Promise<AdminCopilotRuntimeSettings> => {
      const response = await api.get<ApiEnvelope<AdminCopilotRuntimeSettings>>(
        '/api/admin/copilot/settings'
      )
      const result = requireServerSuccess(response.data)
      return {
        enabled_tools: Array.isArray(result.data?.enabled_tools)
          ? normalizeAdminCopilotTools(result.data.enabled_tools)
          : ALL_ADMIN_COPILOT_TOOLS,
        visibility:
          result.data?.visibility === 'dashboard_only'
            ? 'dashboard_only'
            : 'all',
      }
    },
    staleTime: 60_000,
  })
}

export async function updateAdminCopilotSettings(
  request: UpdateAdminCopilotSettingsRequest
): Promise<AdminCopilotSettings> {
  const response = await api.put<ApiEnvelope<AdminCopilotSettings>>(
    '/api/admin/system-settings/copilot',
    request
  )
  return requireServerSuccess(response.data).data
}

export async function fetchAdminCopilotModels(
  request: AdminCopilotModelsRequest
): Promise<string[]> {
  const response = await api.post<ApiEnvelope<string[]>>(
    '/api/admin/copilot/fetch-models',
    request
  )
  return requireServerSuccess(response.data).data ?? []
}
