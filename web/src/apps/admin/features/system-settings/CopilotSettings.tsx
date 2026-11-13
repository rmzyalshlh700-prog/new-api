import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PasswordInput } from '@/shared/components/password-input'
import { SettingsPageFormActions } from '@/shared/components/settings/settings-page-context'
import { SettingsSection } from '@/shared/components/settings/settings-section'
import { Button } from '@/shared/components/ui/button'
import { Combobox } from '@/shared/components/ui/combobox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { Switch } from '@/shared/components/ui/switch'
import { handleServerError } from '@/shared/lib/handle-server-error'

import {
  ADMIN_COPILOT_RUNTIME_QUERY_KEY,
  ADMIN_COPILOT_SETTINGS_QUERY_KEY,
  ADMIN_COPILOT_TOOLS,
  fetchAdminCopilotModels,
  updateAdminCopilotSettings,
  useAdminCopilotSettings,
  type AdminCopilotSettings,
  type AdminCopilotToolName,
  type AdminCopilotVisibility,
} from '../../layout/admin-copilot-config'

interface CopilotFormState {
  base_url: string
  api_key: string
  model: string
  enabled_tools: AdminCopilotToolName[]
  visibility: AdminCopilotVisibility
}

function toFormState(settings: AdminCopilotSettings): CopilotFormState {
  return {
    base_url: settings.base_url,
    api_key: '',
    model: settings.model,
    enabled_tools: settings.enabled_tools,
    visibility: settings.visibility,
  }
}

export function CopilotSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useAdminCopilotSettings()
  const [form, setForm] = useState<CopilotFormState | null>(null)
  const [models, setModels] = useState<string[]>([])

  // Seed the form from the first successful load only. A refetch (window
  // focus, post-save invalidation) must never overwrite edits the admin has
  // not saved yet.
  useEffect(() => {
    if (!settings) return
    setForm((current) => current ?? toFormState(settings))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: updateAdminCopilotSettings,
    onSuccess: async () => {
      toast.success(t('Copilot settings saved successfully'))
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ADMIN_COPILOT_SETTINGS_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ADMIN_COPILOT_RUNTIME_QUERY_KEY,
        }),
      ])
      setForm((current) => (current ? { ...current, api_key: '' } : current))
    },
    onError: (error: Error) => {
      handleServerError(error, t('Failed to save Copilot settings'))
    },
  })

  const modelsMutation = useMutation({
    mutationFn: fetchAdminCopilotModels,
    onSuccess: (result) => {
      setModels(result)
      if (result.length === 0) {
        toast.warning(t('The provider returned no models'))
      } else {
        toast.success(t('Fetched {{count}} models', { count: result.length }))
      }
    },
    onError: (error: Error) => {
      handleServerError(error, t('Failed to fetch models'))
    },
  })

  const comboboxOptions = useMemo(() => {
    const values = [...models]
    if (form?.model && !values.includes(form.model)) values.unshift(form.model)
    return values.map((value) => ({ value, label: value }))
  }, [form?.model, models])

  if (isLoading || !form) {
    return (
      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
        <Loader2 className='size-4 animate-spin' />
        {t('Loading Copilot settings...')}
      </div>
    )
  }

  const canFetchModels = form.base_url.trim().length > 0
  const apiKeyConfigured = settings?.api_key_configured ?? false

  const handleSave = () => {
    saveMutation.mutate({
      base_url: form.base_url.trim(),
      api_key: form.api_key.trim() || undefined,
      model: form.model.trim(),
      enabled_tools: form.enabled_tools,
      visibility: form.visibility,
    })
  }

  const handleFetchModels = () => {
    modelsMutation.mutate({
      base_url: form.base_url.trim(),
      api_key: form.api_key.trim() || undefined,
    })
  }

  const toggleTool = (tool: AdminCopilotToolName, enabled: boolean) => {
    setForm((current) => {
      if (!current) return current
      const next = enabled
        ? [...new Set([...current.enabled_tools, tool])]
        : current.enabled_tools.filter((item) => item !== tool)
      return { ...current, enabled_tools: next }
    })
  }

  return (
    <div className='flex flex-col gap-8'>
      <SettingsPageFormActions
        onSave={handleSave}
        isSaving={saveMutation.isPending}
        saveLabel='Save Copilot settings'
      />

      <SettingsSection title={t('Connection')}>
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='copilot-base-url'>{t('Base URL')}</Label>
            <Input
              id='copilot-base-url'
              type='url'
              inputMode='url'
              autoComplete='off'
              placeholder={t('https://api.openai.com')}
              value={form.base_url}
              onChange={(event) =>
                setForm({ ...form, base_url: event.target.value })
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t(
                'OpenAI-compatible endpoint. It is used for chat completions and model discovery. Leave empty to use the platform relay.'
              )}
            </p>
          </div>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='copilot-api-key'>{t('API Key')}</Label>
            <PasswordInput
              id='copilot-api-key'
              autoComplete='new-password'
              placeholder={
                apiKeyConfigured
                  ? t('Leave empty to keep the saved key')
                  : t('sk-...')
              }
              value={form.api_key}
              onChange={(event) =>
                setForm({ ...form, api_key: event.target.value })
              }
            />
            <p className='text-muted-foreground text-xs'>
              {apiKeyConfigured
                ? t('A key is already saved. Enter a new one to replace it.')
                : t(
                    'The key is stored as an option and never returned to the browser.'
                  )}
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('Model')}>
        <div className='flex flex-col gap-2'>
          <Label>{t('Model ID')}</Label>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Combobox
              options={comboboxOptions}
              value={form.model}
              onValueChange={(value) =>
                setForm({ ...form, model: value ?? '' })
              }
              placeholder={t('Select a model')}
              searchPlaceholder={t('Search models...')}
              emptyText={t('No models found')}
              className='flex-1'
            />
            <Button
              type='button'
              variant='outline'
              onClick={handleFetchModels}
              disabled={!canFetchModels || modelsMutation.isPending}
            >
              {modelsMutation.isPending ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Plus className='size-4' />
              )}
              {t('Fetch Models')}
            </Button>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Fetch the model list from the provider, or type a model ID if it is not listed.'
            )}
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title={t('Tool Permissions')}>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Only enabled tools are sent to the model and can read admin data.'
          )}
        </p>
        <div className='flex flex-col divide-y rounded-lg border'>
          {ADMIN_COPILOT_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className='flex items-start justify-between gap-4 p-4'
            >
              <div className='flex flex-col gap-1'>
                <Label htmlFor={`copilot-tool-${tool.name}`}>
                  {t(tool.labelKey)}
                </Label>
                <p className='text-muted-foreground text-xs'>
                  {t(tool.descriptionKey)}
                </p>
              </div>
              <Switch
                id={`copilot-tool-${tool.name}`}
                checked={form.enabled_tools.includes(tool.name)}
                onCheckedChange={(checked) => toggleTool(tool.name, checked)}
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('Visibility')}>
        <RadioGroup
          value={form.visibility}
          onValueChange={(value) =>
            setForm({
              ...form,
              visibility: value as AdminCopilotVisibility,
            })
          }
        >
          <div className='flex items-start gap-3'>
            <RadioGroupItem id='copilot-visibility-all' value='all' />
            <div className='flex flex-col gap-1'>
              <Label htmlFor='copilot-visibility-all'>
                {t('Show on all admin pages')}
              </Label>
              <p className='text-muted-foreground text-xs'>
                {t('The copilot button is available across the admin console.')}
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <RadioGroupItem
              id='copilot-visibility-dashboard'
              value='dashboard_only'
            />
            <div className='flex flex-col gap-1'>
              <Label htmlFor='copilot-visibility-dashboard'>
                {t('Show on Dashboard only')}
              </Label>
              <p className='text-muted-foreground text-xs'>
                {t('The copilot button is hidden outside the dashboard.')}
              </p>
            </div>
          </div>
        </RadioGroup>
      </SettingsSection>
    </div>
  )
}
