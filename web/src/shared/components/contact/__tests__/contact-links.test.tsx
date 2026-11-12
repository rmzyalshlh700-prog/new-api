import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  CONTACT_LINK_POSITIONS,
  getContactLinkIcon,
  type ContactLink,
} from '../contact-links-data'
import { HeaderContactLinks, SidebarContactLinks } from '../contact-links'

vi.mock('@/shared/lib/api', () => ({
  api: {
    get: vi.fn(async () => ({
      data: {
        success: true,
        data: [
          {
            id: '1',
            title: 'Join Telegram',
            url: 'https://t.me/example',
            icon: 'send',
            position: CONTACT_LINK_POSITIONS.sidebarBottom,
            is_active: true,
          },
          {
            id: '2',
            title: 'Discord',
            url: 'https://discord.gg/example',
            icon: 'message-circle',
            position: CONTACT_LINK_POSITIONS.sidebarBottom,
            is_active: false,
          },
          {
            id: '3',
            title: 'Status Page',
            url: 'https://status.example.com',
            icon: 'unknown-icon-name',
            position: CONTACT_LINK_POSITIONS.headerTop,
            is_active: true,
          },
        ] satisfies ContactLink[],
      },
    })),
  },
}))

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  )
}

describe('contact links rendering', () => {
  it('renders only active sidebar_bottom links at the sidebar bottom', async () => {
    renderWithProviders(
      <SidebarContactLinks position={CONTACT_LINK_POSITIONS.sidebarBottom} />
    )

    const telegram = await screen.findByRole('link', { name: 'Join Telegram' })
    expect(telegram).toHaveAttribute('href', 'https://t.me/example')
    expect(telegram).toHaveAttribute('target', '_blank')
    expect(telegram).toHaveAttribute('rel', 'noopener noreferrer')
    // Inactive links are never rendered.
    expect(screen.queryByRole('link', { name: 'Discord' })).toBeNull()
  })

  it('renders header_top links next to the header toggler', async () => {
    renderWithProviders(<HeaderContactLinks />)

    const status = await screen.findByRole('link', { name: 'Status Page' })
    expect(status).toHaveAttribute('href', 'https://status.example.com')
  })

  it('renders nothing when there are no links for a position', () => {
    const { container } = renderWithProviders(
      <SidebarContactLinks position={CONTACT_LINK_POSITIONS.sidebarTop} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('falls back to the globe icon for unknown icon names', () => {
    expect(getContactLinkIcon('send').displayName ?? '').toBeDefined()
    expect(getContactLinkIcon('does-not-exist')).toBe(
      getContactLinkIcon('globe')
    )
  })
})
