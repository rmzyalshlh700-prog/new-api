/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Separator } from '@/shared/components/ui/separator'
import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '@/shared/components/settings/settings-form-layout'
import { SettingsPageFormActions } from '@/shared/components/settings/settings-page-context'
import { SettingsSection } from '@/shared/components/settings/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const maintenanceModeSchema = z.object({
  maintenance_setting: z.object({
    enabled: z.boolean(),
    html: z.string(),
    whitelist: z.string(),
  }),
})

type MaintenanceModeFormValues = z.infer<typeof maintenanceModeSchema>

type MaintenanceModeSectionProps = {
  defaultValues: {
    'maintenance_setting.enabled': boolean
    'maintenance_setting.html': string
    'maintenance_setting.whitelist': string
  }
}

export function MaintenanceModeSection(props: MaintenanceModeSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const statusTitleId = useId()

  const formDefaults = useMemo<MaintenanceModeFormValues>(
    () => ({
      maintenance_setting: {
        enabled: props.defaultValues['maintenance_setting.enabled'],
        html: props.defaultValues['maintenance_setting.html'] ?? '',
        whitelist: props.defaultValues['maintenance_setting.whitelist'] ?? '',
      },
    }),
    [props.defaultValues]
  )

  const form = useForm<MaintenanceModeFormValues>({
    resolver: zodResolver(maintenanceModeSchema),
    defaultValues: formDefaults,
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: MaintenanceModeFormValues) => {
    const changes = [
      ['maintenance_setting.enabled', values.maintenance_setting.enabled],
      ['maintenance_setting.html', values.maintenance_setting.html],
      ['maintenance_setting.whitelist', values.maintenance_setting.whitelist],
    ] as const
    for (const [key, value] of changes) {
      if (value === props.defaultValues[key]) continue
      await updateOption.mutateAsync({ key, value })
    }
  }

  return (
    <SettingsSection title={t('Maintenance Mode')} className='gap-6'>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save maintenance settings'
          />
          <div
            role='group'
            aria-labelledby={statusTitleId}
            className='flex min-w-0 flex-col gap-4'
          >
            <h4 id={statusTitleId} className='font-medium'>
              {t('Status')}
            </h4>
            <FormField
              control={form.control}
              name='maintenance_setting.enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Enable maintenance mode')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Redirects the dashboard and API to /maintenance. Sign-in, admin routes and authentication APIs stay available, and administrators always keep full access.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </SettingsSwitchItem>
              )}
            />
          </div>

          <Separator />

          <FormField
            control={form.control}
            name='maintenance_setting.whitelist'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Whitelist (Emails/Usernames)')}</FormLabel>
                <FormControl>
                  <Input
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('admin@example.com, root')}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Comma-separated email addresses or usernames that bypass maintenance mode. Matching is case-insensitive.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='maintenance_setting.html'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Custom HTML / iframe')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    className='min-h-48 font-mono'
                    placeholder='<h1>System is currently under maintenance.</h1>'
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Raw HTML shown on the maintenance page. Iframes are allowed. Leave empty to show the default maintenance screen.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
