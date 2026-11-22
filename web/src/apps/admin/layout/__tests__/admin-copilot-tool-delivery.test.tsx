import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { AdminCopilotProvider } from '../admin-copilot-provider'

const ENABLED = ['getFinancialSummary', 'lookupUser']

const RUNTIME_SETTINGS = {
  success: true,
  message: '',
  data: { enabled_tools: ENABLED, visibility: 'all' },
}

const CHAT_INFO = { version: '1.87.1', agents: { default: { description: 'Admin' } } }

const CHAT_REPLY = {
  data: {
    generateCopilotResponse: {
      messages: [
        {
          __typename: 'TextMessageOutput',
          id: 'a1',
          role: 'assistant',
          content: 'reply text',
        },
      ],
      status: { __typename: 'Success', code: 'OK' },
      threadId: 't1',
      runId: 'r1',
    },
  },
}

interface CapturedRequest {
  url: string
  body: Record<string, unknown> | null
}

let captured: CapturedRequest[] = []

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

// The settings hook talks through the app's axios client, which jsdom serves
// over XHR rather than the stubbed fetch; mock the client so the provider sees
// the operator's permission set on its first load.
vi.mock('@/shared/lib/http-client', () => ({
  api: {
    get: vi.fn(async () => ({ data: RUNTIME_SETTINGS })),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouterState: (options: { select: (state: unknown) => unknown }) =>
    options.select({
      location: { pathname: '/admin/overview', href: '/admin/overview' },
    }),
}))

beforeEach(() => {
  captured = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      let body: unknown = CHAT_REPLY
      if (url.endsWith('/chat/info')) body = CHAT_INFO
      const parsed =
        typeof init?.body === 'string' && init.body.startsWith('{')
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : null
      captured.push({ url, body: parsed })
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * The browser must hand the agent its tool catalogue. This regressed once: the
 * actions carried an availability flag that, in this CopilotKit version, made
 * the registration throw on the first settings load, so every run went out with
 * an empty tool list and the assistant answered that it had no tools at all.
 *
 * Which of those tools the run may actually use is decided by the server (see
 * buildCopilotAguiChatRequest), so the assertion here is that the catalogue
 * arrives intact and that the run keeps the granted set as context.
 */
test('the agent receives the tool catalogue even after the settings load', async () => {
  const user = userEvent.setup()
  renderWithProviders(
    <AdminCopilotProvider>
      <div>admin shell</div>
    </AdminCopilotProvider>
  )

  await user.click(screen.getByRole('button', { name: 'Open Admin Copilot' }))
  const textbox = await screen.findByRole('textbox')
  await user.type(textbox, 'how many users are there?')
  await user.keyboard('{Enter}')

  const runRequest = await vi.waitFor(() => {
    const request = captured.find(
      (entry) => Array.isArray(entry.body?.tools) && entry.body?.tools.length
    )
    if (!request) throw new Error('the run request carried no tools')
    return request
  })

  const names = (runRequest.body?.tools as { name: string }[])
    .map((tool) => tool.name)
    .sort()
  expect(names).toContain('lookupUser')
  expect(names).toContain('deleteChannel')
  expect(names.length).toBeGreaterThanOrEqual(18)

  // Every tool description reaches the model, and the granted set is part of
  // the context so the agent knows when a capability is switched off.
  const context = JSON.stringify(runRequest.body?.context ?? [])
  expect(context).toContain('getFinancialSummary')
  expect(context).not.toContain('deleteChannel')

  expect(screen.getByText('admin shell')).toBeInTheDocument()
})

/**
 * A crash inside the tool registration is swallowed by the null error boundary,
 * so the only visible symptom is an assistant without tools. Fail the test if
 * the boundary had to catch anything.
 */
test('registering the tools never throws', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  renderWithProviders(
    <AdminCopilotProvider>
      <div>admin shell</div>
    </AdminCopilotProvider>
  )
  await screen.findByRole('button', { name: 'Open Admin Copilot' })
  const crashed = errors.mock.calls.filter((call) =>
    call.some((value) => String(value).includes('copilot crashed'))
  )
  errors.mockRestore()
  expect(crashed).toHaveLength(0)
})
