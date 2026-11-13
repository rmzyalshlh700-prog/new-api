import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/lib/http-client'
import { requireServerSuccess } from '@/shared/lib/server-error-message'

export type AdminCopilotToolName =
  | 'getFinancialSummary'
  | 'lookupUser'
  | 'getSystemHealth'

export type AdminCopilotVisibility = 'all' | 'dashboard_only'

export interface AdminCopilotSettings {
  base_url: string
  model: string
  enabled_tools: AdminCopilotToolName[]
  visibility: AdminCopilotVisibility
  api_key_configured: boolean
}

export interface UpdateAdminCopilotSettingsRequest {
  base_url: string
  api_key?: string
  clear_api_key?: boolean
  model: string
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

export const ADMIN_COPILOT_TOOLS = [
  {
    name: 'getFinancialSummary',
    labelKey: 'Allow Financial Analysis',
    descriptionKey:
      'Lets the copilot read today and this month revenue, cost and profit stats.',
  },
  {
    name: 'lookupUser',
    labelKey: 'Allow User Lookup',
    descriptionKey:
      'Lets the copilot search users by id, email or username and read their quota and status.',
  },
  {
    name: 'getSystemHealth',
    labelKey: 'Allow System Health Check',
    descriptionKey:
      'Lets the copilot read CPU, memory, load average and network throughput.',
  },
] as const satisfies ReadonlyArray<{
  name: AdminCopilotToolName
  labelKey: string
  descriptionKey: string
}>

export const ALL_ADMIN_COPILOT_TOOLS: AdminCopilotToolName[] =
  ADMIN_COPILOT_TOOLS.map((tool) => tool.name)

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
          ? result.data.enabled_tools
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
          ? result.data.enabled_tools
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
