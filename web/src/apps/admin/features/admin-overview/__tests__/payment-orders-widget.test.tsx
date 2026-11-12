import { render, screen, within } from '@testing-library/react'
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
  it('shows the aggregate count for each status bucket', () => {
    render(<PaymentOrdersWidget groups={groups} loading={false} />)

    expect(
      screen.getByRole('listitem', { name: 'Pending Payments' })
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('listitem', { name: 'Pending Payments' })
      ).getByText('2')
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('listitem', { name: 'Completed Payments' })
      ).getByText('5')
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('listitem', { name: 'Canceled Payments' })
      ).getByText('0')
    ).toBeInTheDocument()
  })

  it('never renders individual orders or table headers', () => {
    render(<PaymentOrdersWidget groups={groups} loading={false} />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('alice')).not.toBeInTheDocument()
    expect(screen.queryByText('carol')).not.toBeInTheDocument()
    expect(screen.queryByText('Username')).not.toBeInTheDocument()
    expect(screen.queryByText('Gateway')).not.toBeInTheDocument()
  })
})
