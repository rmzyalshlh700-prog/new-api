import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PlatformMetricsCards } from '../components/platform-metrics-cards'
import type { DashboardMetrics } from '../types'

const metrics: DashboardMetrics = {
  registered_users: 1234,
  total_liabilities_quota: 500000,
  active_visitors_today: 42,
  failed_requests_today: 7,
}

describe('platform metrics cards', () => {
  it('renders all four metric cards with their values', () => {
    render(<PlatformMetricsCards metrics={metrics} loading={false} />)

    expect(screen.getByText('Total Registered Users')).toBeInTheDocument()
    expect(screen.getByText('Total Customer Balances')).toBeInTheDocument()
    expect(screen.getByText("Today's Active Visitors")).toBeInTheDocument()
    expect(screen.getByText('Failed Requests Today')).toBeInTheDocument()

    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('hides values while loading and keeps card titles', () => {
    render(<PlatformMetricsCards metrics={undefined} loading />)

    expect(screen.getByText('Total Registered Users')).toBeInTheDocument()
    expect(screen.queryByText('1,234')).not.toBeInTheDocument()
  })
})
