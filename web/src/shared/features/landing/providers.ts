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

For commercial licensing, please contact contact@quantumnous.com
*/
export type LandingProvider = {
  id: string
  name: string
  icon: string
  /** Mono mark that inherits `currentColor`, used on dark plates. */
  mono: string
  model: string
  /** Colour mark is a dot or wordmark only; always render the mono glyph. */
  monoOnly?: boolean
}

/** Providers shown in the orbit, the provider grid and the code playground. */
export const LANDING_PROVIDERS: readonly LandingProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'OpenAI.Color',
    mono: 'OpenAI',
    model: 'gpt-4o',
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: 'Claude.Color',
    mono: 'Claude',
    model: 'claude-sonnet-4-6',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: 'Gemini.Color',
    mono: 'Gemini',
    model: 'gemini-2.5-pro',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'DeepSeek.Color',
    mono: 'DeepSeek',
    model: 'deepseek-chat',
  },
  {
    id: 'qwen',
    name: 'Qwen',
    icon: 'Qwen.Color',
    mono: 'Qwen',
    model: 'qwen-max',
  },
  { id: 'xai', name: 'xAI', icon: 'XAI.Color', mono: 'XAI', model: 'grok-3' },
  {
    id: 'kimi',
    name: 'Kimi',
    icon: 'Kimi.Color',
    mono: 'Kimi',
    model: 'moonshot-v1-8k',
    monoOnly: true,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    icon: 'Minimax.Color',
    mono: 'Minimax',
    model: 'MiniMax-Text-01',
  },
]
