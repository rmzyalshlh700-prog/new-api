import { describe, expect, it } from 'vitest'

import {
  ADMIN_COPILOT_READ_ONLY_TOOLS,
  ADMIN_COPILOT_TOOL_GROUPS,
  ADMIN_COPILOT_TOOLS,
  adminCopilotToolsInGroup,
  normalizeAdminCopilotTools,
} from '../admin-copilot-config'

describe('admin copilot tool catalogue', () => {
  it('assigns every tool to a group the console renders', () => {
    const groups = new Set(ADMIN_COPILOT_TOOL_GROUPS.map((group) => group.key))
    for (const tool of ADMIN_COPILOT_TOOLS) {
      expect(groups.has(tool.group)).toBe(true)
    }
  })

  it('leaves no group empty', () => {
    for (const group of ADMIN_COPILOT_TOOL_GROUPS) {
      expect(adminCopilotToolsInGroup(group.key).length).toBeGreaterThan(0)
    }
  })

  it('keeps the read-only preset free of tools that change data', () => {
    for (const name of ADMIN_COPILOT_READ_ONLY_TOOLS) {
      const tool = ADMIN_COPILOT_TOOLS.find((entry) => entry.name === name)
      expect(tool?.risk).toBe('read')
    }
  })

  it('drops names the console does not know and keeps catalogue order', () => {
    expect(
      normalizeAdminCopilotTools(['deleteChannel', 'notARealTool', 'listChannels'])
    ).toEqual(['listChannels', 'deleteChannel'])
  })
})
