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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { IconPicker } from './components/icon-picker'
import {
  addAdminContactLink,
  deleteAdminContactLink,
  getAdminContactLinks,
  updateAdminContactLink,
} from './contact-links-api'

import {
  getContactLinkIcon,
  type ContactLink,
} from '@/shared/components/contact/contact-links-data'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { Dialog } from '@/shared/components/dialog'
import { StatusBadge } from '@/shared/components/status-badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { StaticDataTable } from '@/shared/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/shared/components/data-table/static/static-row-actions'
import { SettingsSection } from '@/shared/components/settings/settings-section'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { handleServerError } from '@/shared/lib/handle-server-error'

const LINK_FORM_ID = 'contact-link-form'

const linkSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters'),
  url: z
    .string()
    .min(1, 'URL is required')
    .max(500, 'URL must be less than 500 characters')
    .regex(/^https?:\/\/\S+$/, 'URL must start with http:// or https://'),
  icon: z.string().min(1, 'Icon is required'),
  position: z.enum(['sidebar_bottom', 'sidebar_top', 'header_top', 'footer']),
  is_active: z.boolean(),
})

type LinkFormValues = z.infer<typeof linkSchema>

const positionBadgeVariant = (position: string) => {
  if (position === 'header_top') {
    return 'blue' as const
  }
  if (position === 'footer') {
    return 'neutral' as const
  }
  return 'cyan' as const
}

const POSITION_OPTIONS: { value: LinkFormValues['position']; label: string }[] = [
  { value: 'sidebar_bottom', label: 'Sidebar (bottom)' },
  { value: 'sidebar_top', label: 'Sidebar (top)' },
  { value: 'header_top', label: 'Header (top nav)' },
  { value: 'footer', label: 'Footer' },
]

const DEFAULT_FORM_VALUES: LinkFormValues = {
  title: '',
  url: '',
  icon: 'globe',
  position: 'sidebar_bottom',
  is_active: true,
}

interface ContactLinksSectionProps {
  enabled?: boolean
  data?: string
}

/**
 * Admin management UI for social/contact links. All operations persist
 * immediately through the /api/admin/contact_links CRUD endpoints.
 */
export function ContactLinksSection(props: ContactLinksSectionProps) {
  void props
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showDialog, setShowDialog] = useState(false)
  const [editingLink, setEditingLink] = useState<ContactLink | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContactLink | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const linksQuery = useQuery({
    queryKey: ['admin', 'contact-links'],
    queryFn: async () => getAdminContactLinks(),
  })

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'contact-links'] })
    void queryClient.invalidateQueries({ queryKey: ['contact-links'] })
  }

  const handleAdd = () => {
    setEditingLink(null)
    form.reset(DEFAULT_FORM_VALUES)
    setShowDialog(true)
  }

  const handleEdit = (link: ContactLink) => {
    setEditingLink(link)
    form.reset({
      title: link.title,
      url: link.url,
      icon: link.icon || 'globe',
      position: link.position,
      is_active: link.is_active,
    })
    setShowDialog(true)
  }

  const handleSubmitForm = async (values: LinkFormValues) => {
    setIsSaving(true)
    try {
      if (editingLink) {
        await updateAdminContactLink({ id: editingLink.id, ...values })
        toast.success(t('Contact link updated successfully'))
      } else {
        await addAdminContactLink(values)
        toast.success(t('Contact link added successfully'))
      }
      invalidate()
      setShowDialog(false)
    } catch (error) {
      handleServerError(error, t('Failed to save contact link'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return
    }
    try {
      await deleteAdminContactLink(deleteTarget.id)
      toast.success(t('Contact link deleted successfully'))
      invalidate()
    } catch (error) {
      handleServerError(error, t('Failed to delete contact link'))
    } finally {
      setDeleteTarget(null)
    }
  }

  const links = linksQuery.data ?? []

  return (
    <SettingsSection title={t('Contact & Social Links')}>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Button onClick={handleAdd} size='sm'>
            <Plus className='me-2 h-4 w-4' />
            {t('Add New Link')}
          </Button>
          <p className='text-muted-foreground text-sm'>
            {t('Links render dynamically in the sidebar and header')}
          </p>
        </div>

        <StaticDataTable<ContactLink>
          data={links}
          getRowKey={(row) => row.id}
          empty={links.length === 0}
          emptyContent={
            linksQuery.isLoading ? (
              <Skeleton className='h-16 w-full' />
            ) : (
              t('No contact links yet')
            )
          }
          columns={[
            {
              id: 'icon',
              header: t('Icon'),
              cell: (row) => {
                const Icon = getContactLinkIcon(row.icon)
                return <Icon className='size-4' aria-hidden='true' />
              },
            },
            {
              id: 'title',
              header: t('Title'),
              cellClassName: 'max-w-xs truncate',
              cell: (row) => row.title,
            },
            {
              id: 'url',
              header: t('URL'),
              cellClassName: 'text-muted-foreground max-w-xs truncate',
              cell: (row) => row.url,
            },
            {
              id: 'position',
              header: t('Position'),
              cell: (row) => {
                const option = POSITION_OPTIONS.find(
                  (item) => item.value === row.position
                )
                return (
                  <StatusBadge variant={positionBadgeVariant(row.position)}>
                    {option ? t(option.label) : row.position}
                  </StatusBadge>
                )
              },
            },
            {
              id: 'is_active',
              header: t('Status'),
              cell: (row) =>
                row.is_active ? (
                  <StatusBadge variant='success'>{t('Active')}</StatusBadge>
                ) : (
                  <StatusBadge variant='neutral'>{t('Inactive')}</StatusBadge>
                ),
            },
            {
              id: 'actions',
              header: t('Actions'),
              cell: (row) => (
                <StaticRowActions
                  editLabel={t('Edit')}
                  deleteLabel={t('Delete')}
                  menuLabel={t('More actions')}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => setDeleteTarget(row)}
                />
              ),
            },
          ]}
        />
      </div>

      <Dialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingLink ? t('Edit Contact Link') : t('Add New Link')}
        description={t(
          'Configure a social or contact link and where it should appear'
        )}
        contentClassName='max-w-xl'
        contentHeight='auto'
        bodyClassName='space-y-4'
        footer={
          <>
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowDialog(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='submit' form={LINK_FORM_ID} disabled={isSaving}>
              {editingLink ? t('Update') : t('Add')}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id={LINK_FORM_ID}
            onSubmit={form.handleSubmit(handleSubmitForm)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Title')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g., Join Telegram')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('URL')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://t.me/your-channel'
                      type='url'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='icon'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Icon')}</FormLabel>
                  <FormControl>
                    <IconPicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='position'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Position')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('Select a position')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POSITION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='is_active'
              render={({ field }) => (
                <FormItem className='flex items-center gap-2'>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <FormLabel className='!mt-0'>
                    {t('Active (visible to users)')}
                  </FormLabel>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('Delete Contact Link')}
        desc={t(
          'This contact link will be permanently removed. Continue?'
        )}
        handleConfirm={handleConfirmDelete}
        confirmText={t('Delete')}
        cancelBtnText={t('Cancel')}
        destructive
      />
    </SettingsSection>
  )
}
