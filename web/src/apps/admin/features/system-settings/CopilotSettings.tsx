import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, Loader2, Plus, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ErrorState } from '@/shared/components/error-state'
import { PasswordInput } from '@/shared/components/password-input'
import { SettingsPageFormActions } from '@/shared/components/settings/settings-page-context'
import { SettingsSection } from '@/shared/components/settings/settings-section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Combobox } from '@/shared/components/ui/combobox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Switch } from '@/shared/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { handleServerError } from '@/shared/lib/handle-server-error'
import { getServerErrorMessage } from '@/shared/lib/server-error-message'

import {
  ADMIN_COPILOT_RUNTIME_QUERY_KEY,
  ADMIN_COPILOT_SETTINGS_QUERY_KEY,
  ADMIN_COPILOT_TOOL_GROUPS,
  ADMIN_COPILOT_TOOLS,
  ALL_ADMIN_COPILOT_TOOLS,
  ADMIN_COPILOT_READ_ONLY_TOOLS,
  adminCopilotToolsInGroup,
  fetchAdminCopilotModels,
  adminCopilotGrantedTools,
  ADMIN_COPILOT_PERMISSIONS_QUERY_KEY,
  isAdminCopilotMasterControlOn,
  updateAdminCopilotPermissions,
  updateAdminCopilotSettings,
  useAdminCopilotPermissions,
  useAdminCopilotSettings,
  type AdminCopilotSettings,
  type AdminCopilotToolName,
  type AdminCopilotToolRisk,
  type AdminCopilotVisibility,
} from '../../layout/admin-copilot-config'

interface CopilotFormState {
  base_url: string
  api_key: string
  model: string
  stream: boolean
  visibility: AdminCopilotVisibility
}

function toFormState(settings: AdminCopilotSettings): CopilotFormState {
  return {
    base_url: settings.base_url,
    api_key: '',
    model: settings.model,
    stream: settings.stream,
    visibility: settings.visibility,
  }
}

/**
 * Section skeleton mirroring the loaded form, so the page keeps its layout
 * while the settings load instead of collapsing to a single spinner line.
 */
function CopilotSettingsSkeleton() {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col gap-8' aria-busy='true'>
      <p className='sr-only' role='status'>
        {t('Loading Copilot settings...')}
      </p>

      <SettingsSection title={t('Connection')}>
        <div className='grid gap-4 md:grid-cols-2'>
          {[0, 1].map((field) => (
            <div key={field} className='flex flex-col gap-2'>
              <Skeleton className='h-3.5 w-20' />
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-3 w-48' />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('Model')}>
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-3.5 w-20' />
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Skeleton className='h-8 flex-1' />
            <Skeleton className='h-8 w-32' />
          </div>
          <Skeleton className='h-3 w-64' />
        </div>
      </SettingsSection>

      <SettingsSection title={t('Tool Permissions')}>
        <div className='flex flex-col divide-y rounded-lg border'>
          {ADMIN_COPILOT_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className='flex items-start justify-between gap-4 p-4'
            >
              <div className='flex flex-col gap-1'>
                <Skeleton className='h-3.5 w-40' />
                <Skeleton className='h-3 w-64' />
              </div>
              <Skeleton className='h-5 w-9 rounded-full' />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('Visibility')}>
        <div className='flex flex-col gap-3'>
          {[0, 1].map((option) => (
            <div key={option} className='flex items-start gap-3'>
              <Skeleton className='size-4 rounded-full' />
              <div className='flex flex-col gap-1'>
                <Skeleton className='h-3.5 w-44' />
                <Skeleton className='h-3 w-60' />
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  )
}

export function CopilotSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminCopilotSettings()
  const [form, setForm] = useState<CopilotFormState | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [toolSearch, setToolSearch] = useState('')
  // A destructive permission is granted in two steps: the switch opens this
  // dialog, and only its action turns the permission on.
  const [pendingDestructive, setPendingDestructive] =
    useState<AdminCopilotToolName | null>(null)

  // The permission matrix has its own endpoint and its own save, because it is
  // a security decision rather than a connection setting: the server validates
  // every name and answers with what it stored, which is what the switches show.
  const {
    data: storedPermissions,
    isLoading: permissionsLoading,
    isError: permissionsFailed,
  } = useAdminCopilotPermissions()
  const [permissionDraft, setPermissionDraft] = useState<
    AdminCopilotToolName[] | null
  >(null)

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

  const permissionsMutation = useMutation({
    mutationFn: updateAdminCopilotPermissions,
    onSuccess: async (saved) => {
      // The server answers with what it stored, so the switches adopt that
      // state instead of the one the browser hoped for.
      setPermissionDraft(adminCopilotGrantedTools(saved.permissions))
      toast.success(t('Copilot permissions saved'))
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ADMIN_COPILOT_PERMISSIONS_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ADMIN_COPILOT_RUNTIME_QUERY_KEY,
        }),
      ])
    },
    onError: (error: Error) => {
      handleServerError(error, t('Failed to save Copilot permissions'))
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

  // A failed load must never leave the page spinning forever: show the failure
  // with a retry instead of locking the form out with no explanation.
  if (isError) {
    return (
      <ErrorState
        title={t('Failed to load Copilot settings')}
        description={getServerErrorMessage(
          error,
          t('Failed to load Copilot settings')
        )}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }

  if (isLoading || !form) {
    return <CopilotSettingsSkeleton />
  }

  const canFetchModels = form.base_url.trim().length > 0
  // The master switch is derived, never stored separately: a single permission
  // switched off below turns it off, which is the rule the server reports back.
  // The switches show the draft once the operator has touched them, and the
  // server's answer until then. Deriving it here instead of seeding state in an
  // effect means a refetch can never overwrite an unsaved flip.
  const storedGrantedTools = adminCopilotGrantedTools(storedPermissions?.permissions)
  const grantedTools = permissionDraft ?? storedGrantedTools
  const masterOn = isAdminCopilotMasterControlOn(grantedTools)
  const permissionsDirty =
    storedPermissions !== undefined &&
    (masterOn !== storedPermissions.master_control ||
      grantedTools.length !== storedGrantedTools.length ||
      grantedTools.some((tool) => !storedPermissions.permissions[tool]))
  const apiKeyConfigured = settings?.api_key_configured ?? false

  const handleSave = () => {
    saveMutation.mutate({
      base_url: form.base_url.trim(),
      api_key: form.api_key.trim() || undefined,
      model: form.model.trim(),
      stream: form.stream,
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
    setPermissionDraft((current) => {
      const tools = current ?? []
      return enabled
        ? [...new Set([...tools, tool])]
        : tools.filter((item) => item !== tool)
    })
  }

  // A whole area at once, for an operator who wants "channels and nothing
  // else" without flipping every switch in it.
  const setGroupEnabled = (
    tools: readonly AdminCopilotToolName[],
    enabled: boolean
  ) => {
    setPermissionDraft((current) => {
      const selected = current ?? []
      return enabled
        ? [...new Set([...selected, ...tools])]
        : selected.filter((tool) => !tools.includes(tool))
    })
  }

  // Presets: the read-only baseline, everything, or nothing at all.
  const setTools = (tools: readonly AdminCopilotToolName[]) => {
    setPermissionDraft([...new Set(tools)])
  }

  const handleSavePermissions = () => {
    permissionsMutation.mutate({
      master_control: masterOn,
      permissions: Object.fromEntries(
        ADMIN_COPILOT_TOOLS.map((tool) => [
          tool.name,
          grantedTools.includes(tool.name),
        ])
      ),
    })
  }

  // The tooltip explains what a switch can do to the platform, which is the
  // difference between reading a number and removing it.
  const riskTooltip = (risk: AdminCopilotToolRisk) => {
    switch (risk) {
      case 'read':
        return t('Only reads platform data. Nothing is changed.')
      case 'write':
        return t(
          'Changes platform state. The effect can be reversed by hand, and every call is recorded in the audit log.'
        )
      default:
        return t(
          'Removes data or credit. The effect cannot be undone from the console, so granting it asks for a confirmation first.'
        )
    }
  }

  const riskLabel = (risk: AdminCopilotToolRisk) => {
    switch (risk) {
      case 'read':
        return t('Reads data')
      case 'write':
        return t('Changes data')
      default:
        return t('Deletes data')
    }
  }

  const riskBadgeVariant = (
    risk: AdminCopilotToolRisk
  ): 'secondary' | 'warning' | 'destructive' => {
    if (risk === 'write') return 'warning'
    if (risk === 'destructive') return 'destructive'
    return 'secondary'
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
          <Label htmlFor='copilot-model'>{t('Model ID')}</Label>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Combobox
              id='copilot-model'
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

      <SettingsSection title={t('Streaming')}>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex flex-col gap-1'>
            <Label htmlFor='copilot-stream'>
              {t('Stream responses from the provider')}
            </Label>
            <p className='text-muted-foreground text-xs'>
              {t(
                'The console renders the reply as the provider generates it instead of showing it all at once.'
              )}
            </p>
          </div>
          <Switch
            id='copilot-stream'
            checked={form.stream}
            onCheckedChange={(checked) => setForm({ ...form, stream: checked })}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t('Tool Permissions')}>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Choose exactly what the copilot may do. A tool you switch off is refused by the server, not only hidden from the model, and every change it makes is recorded in the audit log under your account.'
          )}
        </p>

        <Card className={masterOn ? 'border-primary/50' : undefined}>
          <CardHeader>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex flex-col gap-1'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <ShieldCheck className='size-4' aria-hidden='true' />
                  {t('Master Control')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'One switch for every capability. Turning it on grants all {{total}} permissions; switching any single permission off below turns it off again.',
                    { total: ADMIN_COPILOT_TOOLS.length }
                  )}
                </CardDescription>
                <Badge
                  variant={masterOn ? 'default' : 'secondary'}
                  className='w-fit'
                >
                  {t('{{enabled}} of {{total}} enabled', {
                    enabled: grantedTools.length,
                    total: ADMIN_COPILOT_TOOLS.length,
                  })}
                </Badge>
              </div>
              <div className='flex items-center gap-2'>
                <TooltipProvider delay={200}>
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={t('About the master switch')}
                      className='text-muted-foreground inline-flex'
                    >
                      <Info className='size-4' aria-hidden='true' />
                    </TooltipTrigger>
                    <TooltipContent className='max-w-64'>
                      {t(
                        'The master switch is on only while every permission is granted. Saving it writes the whole matrix to the server in one request.'
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Switch
                  id='copilot-master-control'
                  aria-label={t('Master Control')}
                  checked={masterOn}
                  onCheckedChange={(checked) =>
                    setTools(checked ? ALL_ADMIN_COPILOT_TOOLS : [])
                  }
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setTools(ADMIN_COPILOT_READ_ONLY_TOOLS)}
            >
              {t('Read only')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setTools(ALL_ADMIN_COPILOT_TOOLS)}
            >
              {t('Enable all')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setTools([])}
            >
              {t('Disable all')}
            </Button>
            <div className='ms-auto flex items-center gap-2'>
              {permissionsDirty && (
                <Badge variant='warning'>{t('Unsaved changes')}</Badge>
              )}
              <Button
                type='button'
                size='sm'
                onClick={handleSavePermissions}
                disabled={
                  permissionsMutation.isPending ||
                  permissionsLoading ||
                  permissionsFailed ||
                  !permissionsDirty
                }
              >
                {permissionsMutation.isPending && (
                  <Loader2 className='size-4 animate-spin' aria-hidden='true' />
                )}
                {t('Save permissions')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {permissionsFailed && (
          <p className='text-destructive text-sm'>
            {t(
              'The permission matrix could not be loaded, so the switches are read-only until it is. Reload the page to try again.'
            )}
          </p>
        )}

        <div className='relative'>
          <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-2.5 size-4' />
          <Input
            className='ps-8'
            placeholder={t('Search tools...')}
            value={toolSearch}
            onChange={(event) => setToolSearch(event.target.value)}
          />
        </div>

        <Accordion
          multiple
          defaultValue={ADMIN_COPILOT_TOOL_GROUPS.map((group) => group.key)}
          className='rounded-lg border'
        >
          {ADMIN_COPILOT_TOOL_GROUPS.map((group) => {
            const groupTools = adminCopilotToolsInGroup(group.key).filter(
              (tool) =>
                `${t(tool.labelKey)} ${tool.name}`
                  .toLowerCase()
                  .includes(toolSearch.trim().toLowerCase())
            )
            if (groupTools.length === 0) return null
            const enabledInGroup = groupTools.filter((tool) =>
              grantedTools.includes(tool.name)
            ).length
            return (
              <AccordionItem key={group.key} value={group.key}>
                <AccordionTrigger>
                  <span className='flex flex-1 flex-col items-start gap-0.5 text-start'>
                    <span className='flex items-center gap-2'>
                      {t(group.labelKey)}
                      <Badge variant='outline'>
                        {t('{{enabled}} of {{total}} enabled', {
                          enabled: enabledInGroup,
                          total: groupTools.length,
                        })}
                      </Badge>
                    </span>
                    <span className='text-muted-foreground text-xs font-normal'>
                      {t(group.descriptionKey)}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className='flex flex-col gap-4'>
                  <div className='flex items-center justify-between gap-4'>
                    <Label htmlFor={`copilot-group-${group.key}`}>
                      {t('Toggle every permission in this area')}
                    </Label>
                    <Switch
                      id={`copilot-group-${group.key}`}
                      aria-label={t('Toggle every permission in this area')}
                      checked={enabledInGroup === groupTools.length}
                      onCheckedChange={(checked) =>
                        setGroupEnabled(
                          groupTools.map((tool) => tool.name),
                          checked
                        )
                      }
                    />
                  </div>
                  <div className='divide-y rounded-md border'>
                    {groupTools.map((tool) => (
                      <div
                        key={tool.name}
                        className='flex items-start justify-between gap-4 p-4'
                      >
                        <div className='flex flex-col gap-1'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <Label htmlFor={`copilot-tool-${tool.name}`}>
                              {t(tool.labelKey)}
                            </Label>
                            <Badge variant={riskBadgeVariant(tool.risk)}>
                              {riskLabel(tool.risk)}
                            </Badge>
                            <TooltipProvider delay={200}>
                              <Tooltip>
                                <TooltipTrigger
                                  aria-label={t('About this permission')}
                                  className='text-muted-foreground inline-flex'
                                >
                                  <Info
                                    className='size-3.5'
                                    aria-hidden='true'
                                  />
                                </TooltipTrigger>
                                <TooltipContent className='max-w-64'>
                                  {riskTooltip(tool.risk)}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className='text-muted-foreground text-xs'>
                            {t(tool.descriptionKey)}
                          </p>
                        </div>
                        <Switch
                          id={`copilot-tool-${tool.name}`}
                          checked={grantedTools.includes(tool.name)}
                          onCheckedChange={(checked) => {
                            if (checked && tool.risk === 'destructive') {
                              setPendingDestructive(tool.name)
                              return
                            }
                            toggleTool(tool.name, checked)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>

        <AlertDialog
          open={pendingDestructive !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDestructive(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('Allow a destructive action?')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  'This permission lets the copilot delete data or take credit away, and the effect cannot be undone from the console. Grant it only if the operator is expected to ask for exactly that.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDestructive(null)}>
                {t('Cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingDestructive) toggleTool(pendingDestructive, true)
                  setPendingDestructive(null)
                }}
              >
                {t('Grant the permission')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
