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
  | 'getSystemHealth'
  | 'readMonitoring'
  | 'configureMonitoring'
  | 'toggleMaintenanceMode'
  | 'lookupUser'
  | 'listUsers'
  | 'createUser'
  | 'setUserStatus'
  | 'adjustUserQuota'
  | 'deductUserQuota'
  | 'getFinancialSummary'
  | 'readPayments'
  | 'updatePaymentGateway'
  | 'updateGroupRatio'
  | 'updateModelPricing'
  | 'listChannels'
  | 'getChannel'
  | 'createChannel'
  | 'updateChannel'
  | 'setChannelKey'
  | 'setChannelStatus'
  | 'testChannel'
  | 'deleteChannel'
  | 'listModels'
  | 'setChannelModels'
  | 'searchLogs'
  | 'exportLogs'
  | 'listRedemptions'
  | 'createRedemption'
  | 'listAnnouncements'
  | 'publishAnnouncement'

export type AdminCopilotToolGroup =
  | 'system'
  | 'users'
  | 'commercial'
  | 'channels'
  | 'models'
  | 'data'
  | 'notifications'

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
      key: 'system',
      labelKey: 'System and operations',
      descriptionKey:
        'Health, monitoring, maintenance mode and the platform switches that affect every user.',
    },
    {
      key: 'users',
      labelKey: 'Users and authentication',
      descriptionKey:
        'Finding users, creating accounts, enabling or disabling them, and adding to or deducting from their balance.',
    },
    {
      key: 'commercial',
      labelKey: 'Commercial and payments',
      descriptionKey:
        'Revenue and payment records, payment gateways, group ratios and model pricing.',
    },
    {
      key: 'channels',
      labelKey: 'Channels and providers',
      descriptionKey:
        'Listing, inspecting, creating, editing, testing, disabling and deleting upstream channels, and replacing a provider key.',
    },
    {
      key: 'models',
      labelKey: 'Models',
      descriptionKey:
        'The model catalogue and the models each channel offers.',
    },
    {
      key: 'data',
      labelKey: 'Data and logs',
      descriptionKey:
        'Searching and exporting the usage log, and reading or generating top-up codes.',
    },
    {
      key: 'notifications',
      labelKey: 'Notifications',
      descriptionKey:
        'Reading and publishing console announcements.',
    },
  ]

export const ADMIN_COPILOT_TOOLS: readonly AdminCopilotToolDefinition[] = [
  {
    name: 'getSystemHealth',
    group: 'system',
    risk: 'read',
    labelKey: 'Allow System Health Check',
    descriptionKey:
      'Lets the copilot read CPU, memory, load average and network throughput.',
  },
  {
    name: 'readMonitoring',
    group: 'system',
    risk: 'read',
    labelKey: 'Allow reading monitoring settings',
    descriptionKey:
      'Lets the copilot read the metrics collection settings: whether it is on, the flush interval, the bucket size and the retention days.',
  },
  {
    name: 'configureMonitoring',
    group: 'system',
    risk: 'write',
    labelKey: 'Allow changing monitoring settings',
    descriptionKey:
      'Lets the copilot change metrics collection settings. Only the monitoring options can be written, and the root account is required.',
  },
  {
    name: 'toggleMaintenanceMode',
    group: 'system',
    risk: 'write',
    labelKey: 'Allow toggling maintenance mode',
    descriptionKey:
      'Lets the copilot put the platform into maintenance mode and take it out again. While it is on, the console and the API are closed to everyone but the whitelist. The root account is required.',
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
    name: 'createUser',
    group: 'users',
    risk: 'write',
    labelKey: 'Allow creating users',
    descriptionKey:
      'Lets the copilot create an account with a username, a password and a role. Creating an administrator still needs the secure verification only the console can ask for.',
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
    name: 'adjustUserQuota',
    group: 'users',
    risk: 'write',
    labelKey: 'Allow adding to a user balance',
    descriptionKey:
      'Lets the copilot add credit to a user balance. Every change is recorded in the audit log under the signed-in administrator.',
  },
  {
    name: 'deductUserQuota',
    group: 'users',
    risk: 'destructive',
    labelKey: 'Allow deducting from a user balance',
    descriptionKey:
      'Lets the copilot take credit away from a user balance. A deduction cannot be undone from the console, so this switch asks for a confirmation first.',
  },
  {
    name: 'getFinancialSummary',
    group: 'commercial',
    risk: 'read',
    labelKey: 'Allow Financial Analysis',
    descriptionKey:
      'Lets the copilot read today and this month revenue, cost and profit stats.',
  },
  {
    name: 'readPayments',
    group: 'commercial',
    risk: 'read',
    labelKey: 'Allow reading payments',
    descriptionKey:
      'Lets the copilot page through the top-up and payment records with their trade numbers, amounts and state.',
  },
  {
    name: 'updatePaymentGateway',
    group: 'commercial',
    risk: 'write',
    labelKey: 'Allow changing payment gateways',
    descriptionKey:
      'Lets the copilot write payment gateway settings, including credentials. A credential is only ever written: the copilot never reads a stored key back. The root account is required.',
  },
  {
    name: 'updateGroupRatio',
    group: 'commercial',
    risk: 'write',
    labelKey: 'Allow changing group ratios',
    descriptionKey:
      'Lets the copilot merge new values into the group ratio table, which changes what every group is billed. The root account is required.',
  },
  {
    name: 'updateModelPricing',
    group: 'commercial',
    risk: 'write',
    labelKey: 'Allow changing model pricing',
    descriptionKey:
      'Lets the copilot merge new values into the model ratio, completion ratio and fixed price tables. The root account is required.',
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
    name: 'setChannelKey',
    group: 'channels',
    risk: 'write',
    labelKey: 'Allow replacing a provider key',
    descriptionKey:
      'Lets the copilot write a new upstream key for a channel. The key is write-only: the copilot never reads a stored key back, and it is never shown in a reply.',
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
      'Lets the copilot delete a channel. The channel and its configuration are removed and cannot be restored from the console, so this switch asks for a confirmation first.',
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
    group: 'data',
    risk: 'read',
    labelKey: 'Allow searching usage logs',
    descriptionKey:
      'Lets the copilot search past requests by user, model, channel, group or time range.',
  },
  {
    name: 'exportLogs',
    group: 'data',
    risk: 'read',
    labelKey: 'Allow exporting the usage log',
    descriptionKey:
      'Lets the copilot produce a CSV of the usage log for a filter, up to a bounded number of rows, for a report.',
  },
  {
    name: 'listRedemptions',
    group: 'data',
    risk: 'read',
    labelKey: 'Allow listing redemption codes',
    descriptionKey:
      'Lets the copilot read generated top-up codes and their status.',
  },
  {
    name: 'createRedemption',
    group: 'data',
    risk: 'write',
    labelKey: 'Allow generating redemption codes',
    descriptionKey:
      'Lets the copilot generate top-up codes for a given quota and count, up to 100 codes in one batch.',
  },
  {
    name: 'listAnnouncements',
    group: 'notifications',
    risk: 'read',
    labelKey: 'Allow reading announcements',
    descriptionKey:
      'Lets the copilot read the announcements the console shows to users.',
  },
  {
    name: 'publishAnnouncement',
    group: 'notifications',
    risk: 'write',
    labelKey: 'Allow publishing announcements',
    descriptionKey:
      'Lets the copilot publish an announcement to the console, which every user sees.',
  },
]

export const ALL_ADMIN_COPILOT_TOOLS: AdminCopilotToolName[] =
  ADMIN_COPILOT_TOOLS.map((tool) => tool.name)

/**
 * The master switch is on only while every capability is granted: switching a
 * single tool off turns it off, which is the rule the permissions page renders
 * and the state the server reports back.
 */
export function isAdminCopilotMasterControlOn(
  tools: readonly AdminCopilotToolName[]
): boolean {
  return (
    tools.length === ADMIN_COPILOT_TOOLS.length &&
    ADMIN_COPILOT_TOOLS.every((tool) => tools.includes(tool.name))
  )
}

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
  master_control: boolean
  visibility: AdminCopilotVisibility
  api_key_configured: boolean
}

export interface UpdateAdminCopilotSettingsRequest {
  base_url: string
  api_key?: string
  clear_api_key?: boolean
  model: string
  stream?: boolean
  /**
   * The permission matrix is written through the dedicated
   * `PUT /api/admin/copilot/permissions` endpoint, never through this one: two
   * editors writing the same options from two places is how a grant silently
   * disappears. Omitting it leaves the stored matrix untouched.
   */
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
  master_control: true,
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
      const enabledTools = Array.isArray(result.data?.enabled_tools)
        ? normalizeAdminCopilotTools(result.data.enabled_tools)
        : ALL_ADMIN_COPILOT_TOOLS
      return {
        ...defaultAdminCopilotSettings,
        ...result.data,
        enabled_tools: enabledTools,
        // The switch follows the granted set even when an older server does not
        // send the field, so a single tool switched off never reads as "all".
        master_control:
          result.data?.master_control ??
          isAdminCopilotMasterControlOn(enabledTools),
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

/**
 * The permission matrix the server enforces.
 *
 * This is the shape of `GET /api/admin/copilot/permissions`: the master switch
 * as the server holds it, a granted flag for every catalog tool, and the
 * catalog itself with group and risk, so the page never carries a second copy
 * of the schema that could fall behind the server.
 */
export interface AdminCopilotPermissions {
  master_control: boolean
  permissions: Record<string, boolean>
  catalog: Array<{
    name: string
    group: string
    risk: string
  }>
  groups: string[]
}

export interface UpdateAdminCopilotPermissionsRequest {
  master_control?: boolean
  permissions?: Record<string, boolean>
}

export const ADMIN_COPILOT_PERMISSIONS_QUERY_KEY = [
  'admin-copilot-permissions',
]

/**
 * Reads the matrix. The catalog comes back with it, so a tool the console does
 * not know yet still gets a switch once its labels are translated.
 */
export function useAdminCopilotPermissions() {
  return useQuery({
    queryKey: ADMIN_COPILOT_PERMISSIONS_QUERY_KEY,
    queryFn: async (): Promise<AdminCopilotPermissions> => {
      const response = await api.get<ApiEnvelope<AdminCopilotPermissions>>(
        '/api/admin/copilot/permissions'
      )
      const result = requireServerSuccess(response.data)
      return {
        master_control: Boolean(result.data?.master_control),
        permissions: result.data?.permissions ?? {},
        catalog: Array.isArray(result.data?.catalog) ? result.data.catalog : [],
        groups: Array.isArray(result.data?.groups) ? result.data.groups : [],
      }
    },
    staleTime: 30_000,
  })
}

/**
 * Writes the matrix. The server validates every name against its catalog and
 * answers with the state it stored, which is what the page renders afterwards,
 * so the UI never drifts from what is actually enforced.
 */
export async function updateAdminCopilotPermissions(
  request: UpdateAdminCopilotPermissionsRequest
): Promise<AdminCopilotPermissions> {
  const response = await api.put<ApiEnvelope<AdminCopilotPermissions>>(
    '/api/admin/copilot/permissions',
    request
  )
  return requireServerSuccess(response.data).data
}

/** Turns the granted map into the ordered list the switches bind to. */
export function adminCopilotGrantedTools(
  permissions: Record<string, boolean> | undefined
): AdminCopilotToolName[] {
  if (!permissions) return []
  return ADMIN_COPILOT_TOOLS.filter((tool) => permissions[tool.name]).map(
    (tool) => tool.name
  )
}
