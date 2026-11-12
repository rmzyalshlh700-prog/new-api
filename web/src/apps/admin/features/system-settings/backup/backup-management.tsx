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
import {
  DatabaseBackup,
  DownloadCloud,
  KeyRound,
  Loader2,
  Radio,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/shared/components/layout'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { IconBadge } from '@/shared/components/ui/icon-badge'
import { api } from '@/shared/lib/api'

const INCLUDED_ITEMS = [
  {
    icon: Users,
    titleKey: 'Users & balances',
    descKey: 'Accounts, roles, balances and group assignments.',
  },
  {
    icon: Wallet,
    titleKey: 'Tokens & quotas',
    descKey: 'API tokens, their quotas and model limitations.',
  },
  {
    icon: Radio,
    titleKey: 'Channels & abilities',
    descKey: 'Upstream channels, keys and routing abilities.',
  },
  {
    icon: KeyRound,
    titleKey: 'Models & pricing',
    descKey: 'Model metadata with ratios, tiers and pricing config.',
  },
  {
    icon: Settings2,
    titleKey: 'System settings',
    descKey: 'Group ratios, options and console configuration.',
  },
] as const

const BACKUP_ENDPOINT = '/api/admin/backup/export'
const FALLBACK_FILENAME = 'system_backup.json'

function readFilename(disposition: string | undefined): string {
  const match = disposition?.match(/filename="([^"]+)"/)
  return match?.[1] ?? FALLBACK_FILENAME
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * System backup page: downloads the platform's configuration snapshot from
 * `GET /api/admin/backup/export`. The file is produced by the server, so the
 * browser only streams it to disk and never builds the payload itself.
 */
export function BackupManagement() {
  const { t } = useTranslation()
  const [downloading, setDownloading] = useState(false)
  const [lastDownload, setLastDownload] = useState<string | null>(null)

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const response = await api.get<Blob>(BACKUP_ENDPOINT, {
        responseType: 'blob',
        skipErrorHandler: true,
        disableDuplicate: true,
      })
      saveBlob(
        response.data,
        readFilename(
          response.headers['content-disposition'] as string | undefined
        )
      )
      setLastDownload(new Date().toLocaleString())
      toast.success(t('Backup downloaded'))
    } catch {
      toast.error(t('Failed to download backup'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='inline-flex min-w-0 items-center gap-2'>
          <span className='truncate'>{t('System Backup')}</span>
          <Badge variant='outline' className='shrink-0'>
            Root
          </Badge>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <Card className='gap-0 overflow-hidden py-0'>
            <CardHeader className='border-b p-4 sm:p-6'>
              <div className='flex items-start gap-4'>
                <IconBadge tone='primary' size='lg'>
                  <DatabaseBackup className='size-5' aria-hidden='true' />
                </IconBadge>
                <div className='min-w-0 space-y-1'>
                  <CardTitle>{t('System Backup')}</CardTitle>
                  <CardDescription>
                    {t(
                      'Download a complete snapshot of users, balances, channels, tokens, models and configuration.'
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-6 p-4 sm:p-6'>
              <div className='space-y-3'>
                <p className='text-sm font-medium'>
                  {t('What the backup includes')}
                </p>
                <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                  {INCLUDED_ITEMS.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.titleKey}
                        className='bg-muted/30 flex items-start gap-3 rounded-xl border p-3'
                      >
                        <IconBadge tone='neutral' size='md'>
                          <Icon />
                        </IconBadge>
                        <div className='min-w-0 space-y-0.5'>
                          <p className='text-sm font-medium'>
                            {t(item.titleKey)}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            {t(item.descKey)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className='bg-muted/20 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0 space-y-1'>
                  <p className='text-sm font-medium'>
                    {t('Download Full Backup')}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'A JSON file generated on this server, streamed directly to your device.'
                    )}
                  </p>
                  {lastDownload && (
                    <p className='text-muted-foreground text-xs tabular-nums'>
                      {t('Last download: {{time}}', { time: lastDownload })}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleDownload}
                  disabled={downloading}
                  className='shrink-0'
                  size='lg'
                >
                  {downloading ? (
                    <Loader2
                      className='me-2 size-4 animate-spin'
                      aria-hidden='true'
                    />
                  ) : (
                    <DownloadCloud className='me-2 size-4' aria-hidden='true' />
                  )}
                  {downloading
                    ? t('Preparing backup…')
                    : t('Download Full Backup')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
