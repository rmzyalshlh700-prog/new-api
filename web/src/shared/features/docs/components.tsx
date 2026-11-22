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
import { Link } from '@tanstack/react-router'
import { Check, Copy } from 'lucide-react'
import { Children, isValidElement, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function DocsCard(props: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  href?: string
  external?: boolean
  linkLabel?: string
  className?: string
}) {
  const body = (
    <>
      {props.icon && (
        <span className='text-foreground/70 mb-4 inline-flex size-5 items-center justify-center [&_svg]:size-5'>
          {props.icon}
        </span>
      )}
      <h3 className='text-sm font-semibold tracking-tight'>{props.title}</h3>
      {props.children && (
        <div className='text-muted-foreground mt-1.5 text-[13px] leading-relaxed'>
          {props.children}
        </div>
      )}
      {props.linkLabel && (
        <span className='text-foreground mt-4 inline-flex items-center gap-1 text-[13px] font-medium'>
          {props.linkLabel}
          <span aria-hidden='true'>→</span>
        </span>
      )}
    </>
  )

  const className = cn(
    'block rounded-xl border border-border bg-card p-5 transition-colors',
    props.href && 'hover:border-foreground/25',
    props.className
  )

  if (!props.href) return <div className={className}>{body}</div>
  if (props.external) {
    return (
      <a
        href={props.href}
        target='_blank'
        rel='noopener noreferrer'
        className={className}
      >
        {body}
      </a>
    )
  }
  return (
    <Link to={props.href} className={className}>
      {body}
    </Link>
  )
}

export function DocsCallout(props: {
  title: string
  children: ReactNode
  tone?: 'neutral' | 'warning'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-[13px] leading-relaxed',
        props.tone === 'warning'
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-border bg-muted/30'
      )}
    >
      <p className='font-semibold'>{props.title}</p>
      <div className='text-muted-foreground mt-1'>{props.children}</div>
    </div>
  )
}

export function DocsCodeBlock(props: { code: string; label?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className='border-border bg-muted/30 min-w-0 overflow-hidden rounded-xl border'>
      <div className='border-border flex items-center justify-between gap-2 border-b px-4 py-2'>
        <span className='text-muted-foreground font-mono text-[11px] tracking-wide uppercase'>
          {props.label ?? 'bash'}
        </span>
        <Button
          type='button'
          size='xs'
          variant='ghost'
          onClick={copy}
          aria-label={t('Copy code')}
          className='gap-1.5 font-normal'
        >
          {copied ? (
            <Check className='size-3.5' />
          ) : (
            <Copy className='size-3.5' />
          )}
          {copied ? t('Copied') : t('Copy')}
        </Button>
      </div>
      <pre
        dir='ltr'
        className='min-w-0 overflow-x-auto px-4 py-3.5 text-start font-mono text-[12.5px] leading-relaxed'
      >
        <code>{props.code}</code>
      </pre>
    </div>
  )
}

export function DocsList(props: { items: ReactNode[] }) {
  return (
    <ul className='text-muted-foreground space-y-2 text-[14px] leading-relaxed'>
      {Children.toArray(props.items).map((item) => (
        <li
          key={isValidElement(item) ? item.key : String(item)}
          className='flex gap-2.5'
        >
          <span
            aria-hidden='true'
            className='bg-foreground/50 mt-2 size-1 shrink-0 rounded-full'
          />
          <span className='min-w-0'>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function DocsSectionTitle(props: { children: ReactNode }) {
  return (
    <h2 className='mt-10 mb-3 text-lg font-semibold tracking-tight'>
      {props.children}
    </h2>
  )
}

export function DocsParagraph(props: { children: ReactNode }) {
  return (
    <p className='text-muted-foreground text-[14px] leading-relaxed'>
      {props.children}
    </p>
  )
}
