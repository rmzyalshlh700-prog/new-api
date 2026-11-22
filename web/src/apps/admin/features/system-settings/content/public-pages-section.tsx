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
import { Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/shared/components/dialog'
import { SettingsSection } from '@/shared/components/settings/settings-section'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  emptyLocalizedText,
  type BlogPost,
} from '@/shared/features/public-content/types'
import { cn } from '@/shared/lib/utils'

import { useUpdateOption } from '../hooks/use-update-option'

type PublicPagesSectionProps = {
  docsEnabled: boolean
  integrationsEnabled: boolean
  aboutEnabled: boolean
  blogEnabled: boolean
  posts: string
}

const PAGE_TOGGLES = [
  {
    key: 'public_pages.docs_enabled',
    labelKey: 'Documentation',
    path: '/docs',
  },
  {
    key: 'public_pages.integrations_enabled',
    labelKey: 'Integrations',
    path: '/integrations',
  },
  { key: 'public_pages.about_enabled', labelKey: 'About', path: '/about' },
  { key: 'public_pages.blog_enabled', labelKey: 'Blog', path: '/blog' },
] as const

const LANGUAGE_TABS = [
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'ru', label: 'Русский' },
] as const

function parsePosts(raw: string): BlogPost[] {
  if (!raw.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => {
      const record = item as Partial<BlogPost>
      return {
        id: record.id ?? crypto.randomUUID(),
        slug: record.slug ?? '',
        date: record.date ?? '',
        published: record.published !== false,
        title: { ...emptyLocalizedText(), ...record.title },
        summary: { ...emptyLocalizedText(), ...record.summary },
        body: { ...emptyLocalizedText(), ...record.body },
      }
    })
  } catch {
    return []
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

export function PublicPagesSection(props: PublicPagesSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const [posts, setPosts] = useState<BlogPost[]>(() => parsePosts(props.posts))
  const [syncedPosts, setSyncedPosts] = useState(props.posts)
  const [postsDirty, setPostsDirty] = useState(false)
  const [editing, setEditing] = useState<BlogPost | null>(null)
  const [language, setLanguage] = useState<'en' | 'ar' | 'ru'>('en')

  // Adjust the draft during render when the stored option changes, which is
  // cheaper and more predictable than synchronizing it from an effect.
  if (!postsDirty && props.posts !== syncedPosts) {
    setSyncedPosts(props.posts)
    setPosts(parsePosts(props.posts))
  }

  const enabled: Record<(typeof PAGE_TOGGLES)[number]['key'], boolean> = {
    'public_pages.docs_enabled': props.docsEnabled,
    'public_pages.integrations_enabled': props.integrationsEnabled,
    'public_pages.about_enabled': props.aboutEnabled,
    'public_pages.blog_enabled': props.blogEnabled,
  }

  const togglePage = async (
    key: (typeof PAGE_TOGGLES)[number]['key'],
    value: boolean
  ) => {
    try {
      await updateOption.mutateAsync({ key, value })
    } catch {
      // useUpdateOption already surfaced the error.
    }
  }

  const startNewPost = () => {
    const today = new Date().toISOString().slice(0, 10)
    setEditing({
      id: crypto.randomUUID(),
      slug: '',
      date: today,
      published: true,
      title: emptyLocalizedText(),
      summary: emptyLocalizedText(),
      body: emptyLocalizedText(),
    })
    setLanguage('en')
  }

  const saveEditing = () => {
    if (!editing) return
    const title = editing.title.en.trim()
    if (!title) {
      toast.error(t('An English title is required'))
      return
    }
    const slug = editing.slug.trim() || slugify(title)
    if (!slug) {
      toast.error(t('A slug is required'))
      return
    }
    const next = { ...editing, slug }
    setPosts((previous) => {
      const exists = previous.some((post) => post.id === next.id)
      return exists
        ? previous.map((post) => (post.id === next.id ? next : post))
        : [...previous, next]
    })
    setPostsDirty(true)
    setEditing(null)
    toast.success(t('Post updated. Click "Save Settings" to publish.'))
  }

  const removePost = (id: string) => {
    setPosts((previous) => previous.filter((post) => post.id !== id))
    setPostsDirty(true)
    toast.success(t('Post removed. Click "Save Settings" to apply.'))
  }

  const savePosts = async () => {
    try {
      await updateOption.mutateAsync({
        key: 'public_pages.blog_posts',
        value: JSON.stringify(posts),
      })
      setPostsDirty(false)
    } catch {
      // useUpdateOption already surfaced the error.
    }
  }

  const updateEditingText = (
    field: 'title' | 'summary' | 'body',
    value: string
  ) => {
    if (!editing) return
    setEditing({
      ...editing,
      [field]: { ...editing[field], [language]: value },
    })
  }

  return (
    <div className='flex flex-col gap-10'>
      <SettingsSection title={t('Public Pages')}>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Switch a page off to remove it from the footer, the console Explore group and its public route. Visitors are redirected to the home page.'
          )}
        </p>
        <div className='divide-border border-border divide-y rounded-xl border'>
          {PAGE_TOGGLES.map((page) => (
            <div
              key={page.key}
              className='flex items-center justify-between gap-4 px-4 py-3'
            >
              <div className='min-w-0'>
                <p className='text-sm font-medium'>{t(page.labelKey)}</p>
                <p className='text-muted-foreground font-mono text-[11.5px]'>
                  {page.path}
                </p>
              </div>
              <Switch
                checked={enabled[page.key]}
                onCheckedChange={(checked) => togglePage(page.key, checked)}
                aria-label={t('Show {{page}}', { page: t(page.labelKey) })}
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t('Blog Posts')}>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Posts published here appear above the built-in launch notes, newest first.'
            )}
          </p>
          <div className='flex gap-2'>
            <Button size='sm' onClick={startNewPost}>
              <Plus className='me-1.5 size-4' />
              {t('New post')}
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onClick={savePosts}
              disabled={!postsDirty || updateOption.isPending}
            >
              <Save className='me-1.5 size-4' />
              {t('Save Settings')}
            </Button>
          </div>
        </div>

        {posts.length === 0 ? (
          <p className='border-border text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm'>
            {t(
              'No managed posts yet. The three built-in launch notes remain visible.'
            )}
          </p>
        ) : (
          <div className='divide-border border-border divide-y rounded-xl border'>
            {posts.map((post) => (
              <div
                key={post.id}
                className='flex flex-wrap items-center justify-between gap-3 px-4 py-3'
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium'>
                    {post.title.en || post.slug}
                  </p>
                  <p className='text-muted-foreground font-mono text-[11.5px]'>
                    /blog/{post.slug} · {post.date || t('No date')} ·{' '}
                    {post.published ? t('Published') : t('Draft')}
                  </p>
                </div>
                <div className='flex shrink-0 gap-1.5'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setEditing(post)
                      setLanguage('en')
                    }}
                  >
                    {t('Edit')}
                  </Button>
                  <Button
                    size='icon-sm'
                    variant='destructive'
                    aria-label={t('Delete post')}
                    onClick={() => removePost(post.id)}
                  >
                    <Trash2 className='size-4' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        title={t('Blog post')}
        description={t(
          'Write each language separately. A blank translation falls back to English on the public site.'
        )}
        contentClassName='sm:max-w-2xl'
        contentHeight='min(80vh, 44rem)'
        footer={
          <>
            <Button variant='outline' onClick={() => setEditing(null)}>
              {t('Cancel')}
            </Button>
            <Button onClick={saveEditing}>{t('Add to list')}</Button>
          </>
        }
      >
        {editing && (
          <div className='flex flex-col gap-4'>
            <div className='grid gap-3 sm:grid-cols-2'>
              <label className='flex flex-col gap-1.5'>
                <span className='text-sm font-medium'>{t('Slug')}</span>
                <Input
                  value={editing.slug}
                  placeholder='release-notes'
                  onChange={(event) =>
                    setEditing({ ...editing, slug: event.target.value })
                  }
                />
              </label>
              <label className='flex flex-col gap-1.5'>
                <span className='text-sm font-medium'>{t('Publish date')}</span>
                <Input
                  type='date'
                  value={editing.date}
                  onChange={(event) =>
                    setEditing({ ...editing, date: event.target.value })
                  }
                />
              </label>
            </div>

            <div className='flex items-center gap-2'>
              <Checkbox
                id='blog-post-published'
                checked={editing.published}
                onCheckedChange={(checked) =>
                  setEditing({ ...editing, published: checked === true })
                }
              />
              <label htmlFor='blog-post-published' className='text-sm'>
                {t('Published')}
              </label>
            </div>

            <div className='border-border flex gap-1 border-b pb-2'>
              {LANGUAGE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => setLanguage(tab.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors',
                    language === tab.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <label className='flex flex-col gap-1.5'>
              <span className='text-sm font-medium'>{t('Title')}</span>
              <Input
                value={editing.title[language]}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
                onChange={(event) =>
                  updateEditingText('title', event.target.value)
                }
              />
            </label>
            <label className='flex flex-col gap-1.5'>
              <span className='text-sm font-medium'>{t('Summary')}</span>
              <Textarea
                rows={2}
                value={editing.summary[language]}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
                onChange={(event) =>
                  updateEditingText('summary', event.target.value)
                }
              />
            </label>
            <label className='flex flex-col gap-1.5'>
              <span className='text-sm font-medium'>
                {t('Body (Markdown)')}
              </span>
              <Textarea
                rows={10}
                value={editing.body[language]}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
                className='font-mono text-[12.5px]'
                onChange={(event) =>
                  updateEditingText('body', event.target.value)
                }
              />
            </label>
          </div>
        )}
      </Dialog>
    </div>
  )
}
