import { useHumanInTheLoop } from '@copilotkit/react-core'
import { useTranslation } from 'react-i18next'

import { api } from '@/shared/lib/http-client'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/shared/lib/server-error-message'

import type { ApiEnvelope } from './admin-copilot-config'
import { AdminCopilotConfirmCard } from './admin-copilot-confirm'

/**
 * Runs one confirmed tool call and reports its outcome to the assistant.
 *
 * It never throws: a refused or failed call is answered as `{ error }` so the
 * model can tell the operator what the server said instead of the run hanging
 * on a rejected promise.
 */
async function runConfirmedTool(
  send: () => Promise<{ data: ApiEnvelope<unknown> }>,
  successMessage: string,
  fallbackError: string
): Promise<Record<string, unknown>> {
  try {
    const response = await send()
    requireServerSuccess(response.data)
    return { ok: true, message: successMessage }
  } catch (error) {
    return { error: getServerErrorMessage(error, fallbackError) }
  }
}

const CANCEL_RESULT = {
  cancelled: true,
  message:
    'The operator cancelled this action in the confirmation card. Do not repeat it; ask what they would like to do instead.',
}

/**
 * Registers the destructive capabilities as confirmation cards.
 *
 * The names match the permission catalogue, so a capability switched off in the
 * Copilot settings is still refused server-side; the card only decides *when*
 * the call is sent, never *whether* it is allowed.
 */
export function useAdminCopilotConfirmations() {
  const { t } = useTranslation()

  useHumanInTheLoop({
    name: 'deleteChannel',
    description: t(
      'Delete a channel permanently. Call it as soon as the operator asks: the console shows a confirmation card with the details, so do not ask for confirmation in the chat'
    ),
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'Numeric channel id',
        required: true,
      },
    ],
    render: ({ args, status, respond, result }) => {
      const id = Number((args as { id?: number } | undefined)?.id ?? 0)
      return (
        <AdminCopilotConfirmCard
          title={t('Delete this channel?')}
          description={t(
            'The channel and its configuration are removed permanently.'
          )}
          details={[
            {
              label: t('Channel id'),
              value: id > 0 ? String(id) : t('Unknown'),
            },
          ]}
          status={status}
          result={result}
          execute={() =>
            runConfirmedTool(
              () =>
                api.delete<ApiEnvelope<unknown>>(
                  `/api/admin/copilot/tools/channels/${id}`
                ),
              t('The channel was deleted.'),
              t('Failed to delete the channel.')
            )
          }
          onRespond={(value) => respond?.(value)}
          onCancel={() => respond?.(CANCEL_RESULT)}
        />
      )
    },
  })

  useHumanInTheLoop({
    name: 'deductUserQuota',
    description: t(
      'Take credit away from a user balance. Call it as soon as the operator asks: the console shows a confirmation card with the user and the amount, so do not ask for confirmation in the chat'
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
        description: 'Positive amount to deduct, in quota units',
        required: true,
      },
    ],
    render: ({ args, status, respond, result }) => {
      const values = (args ?? {}) as { id?: number; quota?: number }
      const id = Number(values.id ?? 0)
      const quota = Number(values.quota ?? 0)
      return (
        <AdminCopilotConfirmCard
          title={t('Deduct credit from this user?')}
          description={t('A deduction cannot be undone from the console.')}
          details={[
            { label: t('User id'), value: id > 0 ? String(id) : t('Unknown') },
            {
              label: t('Amount'),
              value: quota > 0 ? quota.toLocaleString() : t('Unknown'),
            },
          ]}
          status={status}
          result={result}
          execute={() =>
            runConfirmedTool(
              () =>
                api.post<ApiEnvelope<unknown>>(
                  '/api/admin/copilot/tools/users/deduct',
                  { id, quota }
                ),
              t('The credit was deducted.'),
              t('Failed to deduct the user quota.')
            )
          }
          onRespond={(value) => respond?.(value)}
          onCancel={() => respond?.(CANCEL_RESULT)}
        />
      )
    },
  })

  useHumanInTheLoop({
    name: 'toggleMaintenanceMode',
    description: t(
      'Put the platform into maintenance mode, or take it out again. Call it as soon as the operator asks: the console shows a confirmation card, so do not ask for confirmation in the chat'
    ),
    parameters: [
      {
        name: 'enabled',
        type: 'boolean',
        description: 'true enters maintenance mode, false leaves it',
        required: true,
      },
    ],
    render: ({ args, status, respond, result }) => {
      const enabled = Boolean(
        (args as { enabled?: boolean } | undefined)?.enabled
      )
      return (
        <AdminCopilotConfirmCard
          title={
            enabled
              ? t('Close the platform for maintenance?')
              : t('Reopen the platform?')
          }
          description={
            enabled
              ? t(
                  'While maintenance mode is on, the console and the API are closed to everyone but the whitelist.'
                )
              : t('The console and the API become reachable again.')
          }
          details={[
            {
              label: t('Maintenance mode'),
              value: enabled ? t('On') : t('Off'),
            },
          ]}
          status={status}
          result={result}
          execute={() =>
            runConfirmedTool(
              () =>
                api.post<ApiEnvelope<unknown>>(
                  '/api/admin/copilot/tools/system/maintenance',
                  { enabled }
                ),
              enabled
                ? t('Maintenance mode is on.')
                : t('Maintenance mode is off.'),
              t('Failed to change maintenance mode.')
            )
          }
          onRespond={(value) => respond?.(value)}
          onCancel={() => respond?.(CANCEL_RESULT)}
        />
      )
    },
  })

  useHumanInTheLoop({
    name: 'purgeLogs',
    description: t(
      'Permanently delete usage log rows inside a time window. Call it as soon as the operator asks: the console shows a confirmation card with the window, so do not ask for confirmation in the chat'
    ),
    parameters: [
      {
        name: 'start_timestamp',
        type: 'number',
        description: 'Start of the window as a Unix timestamp, inclusive',
        required: true,
      },
      {
        name: 'end_timestamp',
        type: 'number',
        description: 'End of the window as a Unix timestamp, exclusive',
        required: true,
      },
      {
        name: 'model_name',
        type: 'string',
        description: 'Only clear rows for this model',
        required: false,
      },
      {
        name: 'username',
        type: 'string',
        description: 'Only clear rows for this username',
        required: false,
      },
    ],
    render: ({ args, status, respond, result }) => {
      const values = (args ?? {}) as {
        start_timestamp?: number
        end_timestamp?: number
        model_name?: string
        username?: string
      }
      const start = Number(values.start_timestamp ?? 0)
      const end = Number(values.end_timestamp ?? 0)
      const format = (seconds: number) =>
        seconds > 0
          ? new Date(seconds * 1000).toISOString().replace('T', ' ').slice(0, 16)
          : t('Unknown')
      const details = [
        { label: t('From'), value: format(start) },
        { label: t('To'), value: format(end) },
      ]
      if (values.model_name) {
        details.push({ label: t('Model'), value: values.model_name })
      }
      if (values.username) {
        details.push({ label: t('Username'), value: values.username })
      }
      return (
        <AdminCopilotConfirmCard
          title={t('Delete these usage logs?')}
          description={t(
            'The rows are removed permanently and cannot be restored from the console. Audit logs are not touched.'
          )}
          details={details}
          status={status}
          result={result}
          execute={() =>
            runConfirmedTool(
              () =>
                api.post<ApiEnvelope<unknown>>(
                  '/api/admin/copilot/tools/logs/purge',
                  {
                    start_timestamp: start,
                    end_timestamp: end,
                    model_name: values.model_name,
                    username: values.username,
                  }
                ),
              t('The usage logs were cleared.'),
              t('Failed to clear the logs.')
            )
          }
          onRespond={(value) => respond?.(value)}
          onCancel={() => respond?.(CANCEL_RESULT)}
        />
      )
    },
  })

  useHumanInTheLoop({
    name: 'deleteAnnouncement',
    description: t(
      'Remove a published console announcement. Call it as soon as the operator asks: the console shows a confirmation card with the announcement, so do not ask for confirmation in the chat'
    ),
    parameters: [
      {
        name: 'index',
        type: 'number',
        description: 'Position in the list listAnnouncements returned, from 1',
        required: true,
      },
    ],
    render: ({ args, status, respond, result }) => {
      const index = Number((args as { index?: number } | undefined)?.index ?? 0)
      return (
        <AdminCopilotConfirmCard
          title={t('Delete this announcement?')}
          description={t('It disappears from the console for every user.')}
          details={[
            {
              label: t('Position'),
              value: index > 0 ? String(index) : t('Unknown'),
            },
          ]}
          status={status}
          result={result}
          execute={() =>
            runConfirmedTool(
              () =>
                api.delete<ApiEnvelope<unknown>>(
                  `/api/admin/copilot/tools/announcements/${index}`
                ),
              t('The announcement was deleted.'),
              t('Failed to delete the announcement.')
            )
          }
          onRespond={(value) => respond?.(value)}
          onCancel={() => respond?.(CANCEL_RESULT)}
        />
      )
    },
  })
}
