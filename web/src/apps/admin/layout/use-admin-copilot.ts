import { useEffect, useMemo, useState } from 'react';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/lib/http-client';

export interface FinancialSummary {
  today: Record<string, number>;
  month: Record<string, number>;
}

export interface CopilotUser {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: number;
  status: number;
  group: string;
  quota: number;
  used_quota: number;
  request_count: number;
}

export interface SystemHealth {
  cpu_usage: number;
  memory_usage: number;
  load1: number;
  download_bps: number;
  upload_bps: number;
  latency_ms: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Registers the admin Copilot's frontend tools (financial summary, user
 * lookup, system health) with CopilotKit and publishes the current page as
 * readable context so the assistant knows where the admin is looking.
 */
export function useAdminCopilot() {
  const { t } = useTranslation();
  const [pageContext, setPageContext] = useState('');

  useEffect(() => {
    const update = () => {
      const { pathname, search } = window.location;
      setPageContext(`${pathname}${search}`);
    };
    update();
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  useCopilotReadable({
    description: t(
      'The admin console page the user is currently viewing, including query parameters',
    ),
    value: pageContext,
  });

  useCopilotAction({
    name: 'getFinancialSummary',
    description: t(
      'Fetch the platform financial summary: today and this month revenue, cost and profit stats',
    ),
    parameters: [],
    handler: async () => {
      const res = await api.get<ApiEnvelope<FinancialSummary>>('/admin/copilot/tools/financials');
      return res.data.data;
    },
  });

  useCopilotAction({
    name: 'lookupUser',
    description: t(
      'Look up platform user details by numeric id, email or username; returns one user or a list of matches',
    ),
    parameters: [
      { name: 'id', type: 'string', description: 'Numeric user id, if known', required: false },
      {
        name: 'keyword',
        type: 'string',
        description: 'Email or username search keyword, used when no id is given',
        required: false,
      },
    ],
    handler: async ({ id, keyword }) => {
      const params = id ? { id } : { keyword };
      const res = await api.get<ApiEnvelope<CopilotUser | CopilotUser[]>>(
        '/admin/copilot/tools/users',
        { params },
      );
      return res.data.data;
    },
  });

  useCopilotAction({
    name: 'getSystemHealth',
    description: t(
      'Fetch current server health: CPU usage, memory usage, load average and network throughput',
    ),
    parameters: [],
    handler: async () => {
      const res = await api.get<ApiEnvelope<SystemHealth>>('/admin/copilot/tools/health');
      return res.data.data;
    },
  });

  const context = useMemo(() => ({ page: pageContext }), [pageContext]);
  return context;
}
