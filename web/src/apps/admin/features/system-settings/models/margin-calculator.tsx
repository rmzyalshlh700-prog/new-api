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
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

/**
 * Provider list prices per 1M tokens (input / output) used to auto-fill the
 * margin calculator's base price. They are starting points only: the operator
 * can always type the exact rate their upstream charges.
 */
const PROVIDER_PRESETS = [
  { value: 'gpt-4o', name: 'GPT-4o', input: 2.5, output: 10 },
  { value: 'gpt-4o-mini', name: 'GPT-4o mini', input: 0.15, output: 0.6 },
  { value: 'gpt-4.1', name: 'GPT-4.1', input: 2, output: 8 },
  {
    value: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    input: 3,
    output: 15,
  },
  { value: 'claude-opus-4', name: 'Claude Opus 4', input: 15, output: 75 },
  { value: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', input: 1.25, output: 10 },
  {
    value: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    input: 0.3,
    output: 2.5,
  },
  { value: 'deepseek-v3', name: 'DeepSeek V3', input: 0.27, output: 1.1 },
] as const

const CUSTOM_PRESET = 'custom'

/** Rounds a derived price to at most 6 decimals without trailing zeros. */
function toPriceString(value: number): string {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  return String(rounded)
}

function parseAmount(value: string): number {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : 0
}

export interface RatioMarginCalculatorProps {
  /** Groups available as markup targets, with their current ratio. */
  groups: { id: string; name: string; ratio: string }[]
  /** Writes the computed final ratio into the selected group. */
  onChange: (id: string, ratio: string) => void
}

/**
 * Ratio variant of the margin calculator: a group ratio is a multiplier on the
 * base price, so the same base + markup formula produces the final ratio.
 */
export function RatioMarginCalculator(props: RatioMarginCalculatorProps) {
  const { t } = useTranslation()
  const [targetId, setTargetId] = useState('')
  const [baseRatio, setBaseRatio] = useState('1')
  const [margin, setMargin] = useState('0')

  const finalRatio = parseAmount(baseRatio) * (1 + parseAmount(margin) / 100)

  const apply = (nextBase: string, nextMargin: string, id = targetId) => {
    if (!id) return
    const next = parseAmount(nextBase) * (1 + parseAmount(nextMargin) / 100)
    props.onChange(id, toPriceString(next))
  }

  // Selecting a group only seeds the base ratio with its current value; the
  // ratio is rewritten once the operator changes the base or the margin.
  const handleTargetChange = (id: string) => {
    setTargetId(id)
    const group = props.groups.find((candidate) => candidate.id === id)
    if (group) setBaseRatio(group.ratio)
  }

  return (
    <div className='bg-muted/30 flex flex-wrap items-end gap-3 rounded-lg border p-3'>
      <div className='min-w-40 flex-1 space-y-1'>
        <Label className='text-muted-foreground text-xs'>
          {t('Apply to group')}
        </Label>
        <Select
          items={props.groups.map((group) => ({
            value: group.id,
            label: `${group.name} · ${group.ratio}`,
          }))}
          value={targetId || null}
          onValueChange={(value) => value && handleTargetChange(value)}
        >
          <SelectTrigger size='sm' className='w-full'>
            <SelectValue placeholder={t('Select a group')} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {props.groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {`${group.name} · ${group.ratio}`}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className='w-28 space-y-1'>
        <Label
          htmlFor='margin-base-ratio'
          className='text-muted-foreground text-xs'
        >
          {t('Base ratio')}
        </Label>
        <Input
          id='margin-base-ratio'
          inputMode='decimal'
          className='h-8'
          value={baseRatio}
          onChange={(event) => {
            setBaseRatio(event.target.value)
            apply(event.target.value, margin)
          }}
        />
      </div>

      <div className='w-24 space-y-1'>
        <Label
          htmlFor='margin-ratio-percent'
          className='text-muted-foreground text-xs'
        >
          {t('Profit margin (%)')}
        </Label>
        <Input
          id='margin-ratio-percent'
          inputMode='decimal'
          className='h-8'
          value={margin}
          onChange={(event) => {
            setMargin(event.target.value)
            apply(baseRatio, event.target.value)
          }}
        />
      </div>

      <div className='w-32 space-y-1'>
        <Label
          htmlFor='margin-final-ratio'
          className='text-muted-foreground text-xs'
        >
          {t('Final ratio')}
        </Label>
        <Input
          id='margin-final-ratio'
          readOnly
          className='h-8'
          value={toPriceString(finalRatio)}
        />
      </div>
    </div>
  )
}

export interface MarginCalculatorProps {
  /** Current retail input price of the tier (per 1M tokens). */
  inputPrice: string | number
  /** Current retail output price of the tier (per 1M tokens). */
  outputPrice: string | number
  /** Currency symbol shown next to the amounts, e.g. `$`. */
  symbol: string
  /** Writes the final price into the tier's token prices (`p` input, `c` output). */
  onChange: (variable: 'p' | 'c', value: string) => void
}

/**
 * Margin calculator: provider base price + profit margin produces the final
 * retail price, which is written straight into the tier's input and output
 * token prices so the existing save path persists it unchanged.
 */
export function MarginCalculator(props: MarginCalculatorProps) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<string>(CUSTOM_PRESET)
  const [baseInput, setBaseInput] = useState(() =>
    toPriceString(parseAmount(String(props.inputPrice)))
  )
  const [baseOutput, setBaseOutput] = useState(() =>
    toPriceString(parseAmount(String(props.outputPrice)))
  )
  const [margin, setMargin] = useState('0')

  const marginValue = parseAmount(margin)
  const finalInput = parseAmount(baseInput) * (1 + marginValue / 100)
  const finalOutput = parseAmount(baseOutput) * (1 + marginValue / 100)

  const apply = (
    nextBaseInput: string,
    nextBaseOutput: string,
    nextMargin: string
  ) => {
    const factor = 1 + parseAmount(nextMargin) / 100
    props.onChange('p', toPriceString(parseAmount(nextBaseInput) * factor))
    props.onChange('c', toPriceString(parseAmount(nextBaseOutput) * factor))
  }

  const handlePresetChange = (value: string) => {
    setPreset(value)
    const found = PROVIDER_PRESETS.find((item) => item.value === value)
    if (!found) return
    const input = toPriceString(found.input)
    const output = toPriceString(found.output)
    setBaseInput(input)
    setBaseOutput(output)
    apply(input, output, margin)
  }

  const handleMarginChange = (value: string) => {
    setMargin(value)
    apply(baseInput, baseOutput, value)
  }

  const handleBaseInputChange = (value: string) => {
    setPreset(CUSTOM_PRESET)
    setBaseInput(value)
    apply(value, baseOutput, margin)
  }

  const handleFinalChange = (value: string) => {
    const base = parseAmount(baseInput)
    if (base <= 0) return
    const nextMargin = toPriceString((parseAmount(value) / base - 1) * 100)
    setMargin(nextMargin)
    apply(baseInput, baseOutput, nextMargin)
  }

  const handleReload = () => {
    const input = toPriceString(parseAmount(String(props.inputPrice)))
    const output = toPriceString(parseAmount(String(props.outputPrice)))
    setPreset(CUSTOM_PRESET)
    setBaseInput(input)
    setBaseOutput(output)
    setMargin('0')
    apply(input, output, '0')
  }

  return (
    <div className='bg-muted/30 space-y-3 rounded-lg border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <p className='text-sm font-semibold'>{t('Margin Calculator')}</p>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Set the provider base price and markup; the final price is written to this tier’s input and output prices.'
            )}
          </p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={handleReload}
          className='h-7 px-2 text-xs'
        >
          <RefreshCw className='me-1 h-3 w-3' />
          {t('Load current prices')}
        </Button>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div className='w-48 space-y-1'>
          <Label className='text-muted-foreground text-xs'>
            {t('Provider preset')}
          </Label>
          <Select
            items={[
              { value: CUSTOM_PRESET, label: t('Custom') },
              ...PROVIDER_PRESETS.map((item) => ({
                value: item.value,
                label: `${item.name} · ${item.input} / ${item.output}`,
              })),
            ]}
            value={preset}
            onValueChange={(value) => value && handlePresetChange(value)}
          >
            <SelectTrigger size='sm' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value={CUSTOM_PRESET}>{t('Custom')}</SelectItem>
                {PROVIDER_PRESETS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {`${item.name} · ${item.input} / ${item.output}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className='w-36 space-y-1'>
          <Label
            htmlFor='margin-base-input'
            className='text-muted-foreground text-xs'
          >
            {t('Provider base price')}
          </Label>
          <Input
            id='margin-base-input'
            inputMode='decimal'
            className='h-8'
            value={baseInput}
            onChange={(event) => handleBaseInputChange(event.target.value)}
            placeholder='2.5'
          />
        </div>

        <div className='w-28 space-y-1'>
          <Label
            htmlFor='margin-percent'
            className='text-muted-foreground text-xs'
          >
            {t('Profit margin (%)')}
          </Label>
          <Input
            id='margin-percent'
            inputMode='decimal'
            className='h-8'
            value={margin}
            onChange={(event) => handleMarginChange(event.target.value)}
            placeholder='20'
          />
        </div>

        <div className='w-36 space-y-1'>
          <Label
            htmlFor='margin-final-price'
            className='text-muted-foreground text-xs'
          >
            {t('Final price')}
          </Label>
          <Input
            id='margin-final-price'
            inputMode='decimal'
            className='h-8'
            value={toPriceString(finalInput)}
            onChange={(event) => handleFinalChange(event.target.value)}
          />
        </div>
      </div>

      <p className='text-muted-foreground text-xs tabular-nums'>
        {t('Output price: {{base}} → {{final}}', {
          base: `${props.symbol}${toPriceString(parseAmount(baseOutput))}`,
          final: `${props.symbol}${toPriceString(finalOutput)}`,
        })}
        {' · '}
        {t('Per 1M tokens')}
      </p>
    </div>
  )
}
