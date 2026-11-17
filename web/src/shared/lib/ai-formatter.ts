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

/**
 * The house style for answers the AI assistant writes.
 *
 * Two things live here: the rules the assistant is told to follow, and the
 * small amount of normalisation the console applies to what it did write. The
 * rules are written once, so the system prompt, the response wrapper and the
 * tests cannot drift apart, and the normaliser keeps a sloppy answer (a polite
 * opener, starred bullets, a wall of blank lines) looking like every other one.
 *
 * Everything in this module is pure and free of React, so it can be used from
 * the server prompt, the chat UI and a unit test alike.
 */

/** What kind of answer this is, which decides the icon shown beside it. */
export type AiResponseKind = 'answer' | 'data_table' | 'warning' | 'error' | 'empty'

/** How strongly the answer should be marked in the UI. */
export type AiResponseSeverity = 'info' | 'warning' | 'error'

export interface AiResponseMeta {
  kind: AiResponseKind
  /** Translation key of the short label shown beside the icon. */
  labelKey: string
  severity: AiResponseSeverity
  /** Descriptive icon name; the UI maps it to a lucide-react component. */
  icon: 'sparkles' | 'table' | 'alert-triangle' | 'octagon-alert' | 'circle-dashed'
}

/**
 * The rules the assistant is instructed to follow. They are deliberately short:
 * a long style guide competes with the operator's actual question.
 */
export const AI_FORMAT_RULES: readonly string[] = [
  'Lead with the direct answer in one line, then the detail. No greeting, no preamble, no restating the question.',
  'Use "- " bullet points for any list of two or more items, one idea per line.',
  'Use **bold** for key metrics, identifiers, ids and amounts, never for whole sentences.',
  'Use a Markdown table (header row, then a |---|---| separator) when comparing two or more items across two or more fields.',
  'Keep numbers exactly as the tool returned them; never estimate or round a figure the tools did not report.',
  'Say plainly when a capability is switched off or a value is unknown, instead of guessing.',
  'Keep one blank line between blocks and no trailing whitespace.',
]

/** The rules as a single instruction block, for a system prompt. */
export const AI_FORMAT_PROMPT = AI_FORMAT_RULES.map(
  (rule, index) => `${index + 1}. ${rule}`
).join(' ')

const RESPONSE_META: Record<AiResponseKind, AiResponseMeta> = {
  answer: {
    kind: 'answer',
    labelKey: 'Answer',
    severity: 'info',
    icon: 'sparkles',
  },
  data_table: {
    kind: 'data_table',
    labelKey: 'Data table',
    severity: 'info',
    icon: 'table',
  },
  warning: {
    kind: 'warning',
    labelKey: 'Warning',
    severity: 'warning',
    icon: 'alert-triangle',
  },
  error: {
    kind: 'error',
    labelKey: 'Error',
    severity: 'error',
    icon: 'octagon-alert',
  },
  empty: {
    kind: 'empty',
    labelKey: 'Empty answer',
    severity: 'info',
    icon: 'circle-dashed',
  },
}

const ERROR_PATTERN = /^\s*(error|failed|failure|denied|refused|not allowed)\b/i
const WARNING_PATTERN =
  /^\s*(warning|caution|careful|note:)\b/i
const TABLE_SEPARATOR_PATTERN = /^\s*\|?[\s:-]*\|[\s:|-]*\|?\s*$/
// A greeting carries no information, so it is dropped; the sentence behind it
// is kept. The punctuation (or the line break) is required, so a real sentence
// that happens to start with one of these words is left alone.
const POLITE_OPENER_PATTERN =
  /^\s*(?:sure|certainly|of course|absolutely|no problem|great question)\s*(?:[!.,:]+\s*|\n+)/i

/** Reports whether a line is a Markdown table separator such as |---|---|. */
export function isMarkdownTableSeparator(line: string): boolean {
  return line.includes('|') && TABLE_SEPARATOR_PATTERN.test(line)
}

/** Reports whether the text contains a Markdown table. */
export function hasMarkdownTable(content: string): boolean {
  const lines = content.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes('|')) continue
    const next = lines[index + 1]
    if (next && isMarkdownTableSeparator(next)) return true
  }
  return false
}

/** Classifies an answer so the UI can label it with the right icon. */
export function classifyAiResponse(content: string): AiResponseKind {
  const trimmed = content.trim()
  if (trimmed === '') return 'empty'
  const firstLine = trimmed.split('\n', 1)[0]
  if (ERROR_PATTERN.test(firstLine)) return 'error'
  if (WARNING_PATTERN.test(firstLine)) return 'warning'
  if (hasMarkdownTable(trimmed)) return 'data_table'
  return 'answer'
}

/** Returns the label and severity metadata for an answer. */
export function aiResponseMeta(content: string): AiResponseMeta {
  return RESPONSE_META[classifyAiResponse(content)]
}

/**
 * Normalises an answer into the house style: no polite opener, dashed bullets,
 * at most one blank line between blocks, no trailing whitespace.
 */
export function formatAiAnswer(content: string): string {
  if (content.trim() === '') return ''
  const withoutOpener = content.replace(POLITE_OPENER_PATTERN, '')
  const lines = withoutOpener.split('\n').map((line) => {
    const trimmedEnd = line.replace(/[ \t]+$/, '')
    // A "* " bullet and a "• " bullet both render, but only "- " matches the
    // style the rest of the console uses.
    const bullet = trimmedEnd.match(/^\s*[*•]\s+(.*)$/)
    if (bullet) return `- ${bullet[1]}`
    return trimmedEnd
  })
  const collapsed: string[] = []
  for (const line of lines) {
    const blank = line.trim() === ''
    if (blank && collapsed.at(-1) === '') {
      continue
    }
    collapsed.push(blank ? '' : line)
  }
  return collapsed.join('\n').trim()
}

/** Renders one key metric as a bold bullet, the shape a tool result takes. */
export function formatAiMetric(label: string, value: string | number): string {
  return `- **${label}**: ${value}`
}

/**
 * Renders a Markdown table. Cells have their pipes escaped, so a value taken
 * from the platform cannot break the table it is shown in.
 */
export function formatAiTable(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[]
): string {
  if (headers.length === 0) return ''
  const escape = (cell: string | number) => String(cell).replaceAll('|', '\\|')
  const header = `| ${headers.map(escape).join(' | ')} |`
  const separator = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map(
    (row) => `| ${headers.map((_, index) => escape(row[index] ?? '')).join(' | ')} |`
  )
  return [header, separator, ...body].join('\n')
}
