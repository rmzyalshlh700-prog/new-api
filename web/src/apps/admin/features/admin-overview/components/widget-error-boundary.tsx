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
import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/shared/components/error-state'

type WidgetErrorBoundaryProps = {
  children: ReactNode
}

type WidgetErrorBoundaryState = {
  error: Error | null
}

/**
 * Keeps a render crash inside one overview panel (chart, table, sparkline)
 * from blanking the whole control panel. Renders a localized, recoverable
 * fallback in place; retry resets the boundary and remounts the subtree.
 */
function WidgetErrorFallback(props: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <ErrorState
      className='min-h-[220px]'
      title={t('This section failed to load')}
      description={t('Please try again or pick a different date range.')}
      onRetry={props.onRetry}
    />
  )
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[admin-overview] widget render crashed', error, info.componentStack)
  }

  handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error == null) return this.props.children
    return <WidgetErrorFallback onRetry={this.handleRetry} />
  }
}
