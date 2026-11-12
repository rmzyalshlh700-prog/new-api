import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { PaymentOrdersWidget } from '../components/payment-orders-widget'
import type { PaymentOrderGroup } from '../types'

const groups: PaymentOrderGroup[] = [
  {
    key: 'pending',
    statuses: ['pending'],
    count: 2,
    amount: 30,
    recent: [
      {
        user_id: 1,
        username: 'alice',
        money: 20,
        trade_no: 'p2',
        payment_method: 'epay',
        payment_provider: 'epay',
        status: 'pending',
        create_time: 1700000000,
      },
      {
        user_id: 2,
        username: '',
        money: 10,
        trade_no: 'p1',
        payment_method: 'stripe',
        payment_provider: '',
        status: 'pending',
        create_time: 1699990000,
      },
    ],
  },
  {
    key: 'completed',
    statuses: ['success'],
    count: 5,
    amount: 120,
    recent: [
      {
        user_id: 3,
        username: 'carol',
        money: 40,
        trade_no: 'c1',
        payment_method: 'creem',
        payment_provider: 'creem',
        status: 'success',
        create_time: 1700010000,
      },
    ],
  },
  {
    key: 'failed',
    statuses: ['failed', 'expired'],
    count: 0,
    amount: 0,
    recent: [],
  },
]

describe('payment orders widget', () => {
  it('shows the count and amount for each status bucket', () => {
    render(<PaymentOrdersWidget groups={groups} loading={false} />)

    expect(
      screen.getByRole('tab', { name: 'Pending Payments' })
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('tab', { name: 'Completed Payments' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Canceled Payments' })
    ).toBeInTheDocument()
  })

  it('shows the recent pending transactions for the selected bucket and switches on click', async () => {
    render(<PaymentOrdersWidget groups={groups} loading={false} />)

    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getAllByText('Unknown user').length).toBeGreaterThan(0)

    await userEvent.click(
      screen.getByRole('tab', { name: 'Completed Payments' })
    )
    expect(screen.getByText('carol')).toBeInTheDocument()
    expect(screen.queryByText('alice')).not.toBeInTheDocument()
  })

  it('shows an empty state for a bucket without recent transactions', async () => {
    render(<PaymentOrdersWidget groups={groups} loading={false} />)

    await userEvent.click(
      screen.getByRole('tab', { name: 'Canceled Payments' })
    )
    expect(screen.getByText('No recent transactions')).toBeInTheDocument()
  })
})
