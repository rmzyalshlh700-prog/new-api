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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { IconPicker } from '../icon-picker'

describe('contact-link icon picker', () => {
  it('renders brand icons in their official colours', async () => {
    const user = userEvent.setup()
    render(<IconPicker value='send' onChange={() => undefined} />)

    await user.click(screen.getByRole('combobox'))

    const discord = await screen.findByRole('button', { name: 'Discord' })
    expect(discord.querySelector('svg')).toHaveAttribute('fill', '#5865F2')

    const whatsapp = screen.getByRole('button', { name: 'WhatsApp' })
    expect(whatsapp.querySelector('svg')).toHaveAttribute('fill', '#25D366')
  })

  it('keeps the search filter across brand icons', async () => {
    const user = userEvent.setup()
    render(<IconPicker value='send' onChange={() => undefined} />)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByPlaceholderText('Search icons...'), 'whatsapp')

    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discord' })).toBeNull()
  })
})
