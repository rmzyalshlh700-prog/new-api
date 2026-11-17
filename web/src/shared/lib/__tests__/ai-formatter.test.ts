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
import { describe, expect, it } from 'vitest'

import {
  AI_FORMAT_RULES,
  aiResponseMeta,
  classifyAiResponse,
  formatAiAnswer,
  formatAiMetric,
  formatAiTable,
  hasMarkdownTable,
} from '../ai-formatter'

describe('classifyAiResponse', () => {
  it('marks a plain answer', () => {
    expect(classifyAiResponse('**3 channels** are enabled.')).toBe('answer')
  })

  it('marks a table answer', () => {
    const table = formatAiTable(['model', 'quota'], [['gpt-4o', 12]])
    expect(hasMarkdownTable(table)).toBe(true)
    expect(classifyAiResponse(table)).toBe('data_table')
  })

  it('marks a warning and an error by their first line', () => {
    expect(classifyAiResponse('Warning: this deducts credit.')).toBe('warning')
    expect(classifyAiResponse('Failed: channel 4 rejected the request.')).toBe(
      'error'
    )
  })

  it('marks an empty answer and exposes its metadata', () => {
    expect(classifyAiResponse('   ')).toBe('empty')
    expect(aiResponseMeta('   ').kind).toBe('empty')
    expect(aiResponseMeta('Warning: careful').severity).toBe('warning')
  })
})

describe('formatAiAnswer', () => {
  it('drops a polite opener and keeps the answer', () => {
    expect(formatAiAnswer('Sure! Here is the list:\n\n- a\n- b')).toBe(
      'Here is the list:\n\n- a\n- b'
    )
  })

  it('turns starred and dotted bullets into dashed ones', () => {
    expect(formatAiAnswer('* one\n• two')).toBe('- one\n- two')
  })

  it('collapses runs of blank lines and trailing spaces', () => {
    expect(formatAiAnswer('a   \n\n\n\nb   ')).toBe('a\n\nb')
  })

  it('leaves an empty answer empty', () => {
    expect(formatAiAnswer('   \n ')).toBe('')
  })
})

describe('formatAiMetric and formatAiTable', () => {
  it('renders a metric as a bold bullet', () => {
    expect(formatAiMetric('Revenue today', '$12.50')).toBe(
      '- **Revenue today**: $12.50'
    )
  })

  it('escapes a pipe so a value cannot break the table', () => {
    const table = formatAiTable(['name', 'note'], [['a|b', 'ok']])
    expect(table.split('\n')[2]).toBe('| a\\|b | ok |')
  })

  it('returns nothing for a table without headers', () => {
    expect(formatAiTable([], [])).toBe('')
  })
})

describe('AI_FORMAT_RULES', () => {
  it('states the no-fluff, bullet, bold and table contract', () => {
    const rules = AI_FORMAT_RULES.join(' ')
    expect(rules).toContain('No greeting')
    expect(rules).toContain('bullet points')
    expect(rules).toContain('**bold**')
    expect(rules).toContain('Markdown table')
  })
})
