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
import { ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'

import {
  CONTACT_LINK_ICONS,
  getContactLinkIcon,
} from '@/shared/components/contact/contact-links-data'
import { cn } from '@/shared/lib/utils'

interface IconPickerProps {
  value: string
  onChange: (iconName: string) => void
}

/**
 * Lightweight visual icon picker over the shared contact-link icon
 * registry: searchable grid, click to select. Stores the icon name, not
 * the component.
 */
export function IconPicker(props: IconPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return CONTACT_LINK_ICONS
    }
    return CONTACT_LINK_ICONS.filter(
      (entry) =>
        entry.name.includes(query) ||
        entry.label.toLowerCase().includes(query)
    )
  }, [search])

  const SelectedIcon = getContactLinkIcon(props.value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className='w-full justify-between font-normal'
          />
        }
      >
        <span className='flex items-center gap-2'>
          <SelectedIcon className='size-4' />
          {props.value || t('Select an icon')}
        </span>
        <ChevronsUpDown className='size-4 opacity-50' />
      </PopoverTrigger>
      <PopoverContent className='w-64 p-2' align='start'>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('Search icons...')}
          className='mb-2 h-8'
        />
        <div className='grid max-h-48 grid-cols-6 gap-1 overflow-y-auto'>
          {filtered.map((entry) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.name}
                type='button'
                aria-label={entry.label}
                title={entry.label}
                onClick={() => {
                  props.onChange(entry.name)
                  setOpen(false)
                  setSearch('')
                }}
                className={cn(
                  'hover:bg-accent flex size-9 items-center justify-center rounded-md',
                  props.value === entry.name &&
                    'bg-accent text-accent-foreground'
                )}
              >
                <Icon className='size-4' />
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className='text-muted-foreground col-span-6 py-4 text-center text-sm'>
              {t('No icons found')}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
