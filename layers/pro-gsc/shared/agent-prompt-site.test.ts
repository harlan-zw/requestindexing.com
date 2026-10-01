import { describe, expect, it } from 'vitest'
import { agentPromptSite } from './agent-prompt-site'

const LINKED = { siteId: 'ri_1', domain: 'example.com', property: 'sc-domain:example.com', gscdumpSiteId: 's_abc', syncStatus: 'synced', hold: null } as const

describe('agentPromptSite', () => {
  it('reads the first Site that gscdump links and imports', () => {
    expect(agentPromptSite([LINKED])).toEqual({ gscdumpSiteId: 's_abc', host: 'example.com' })
  })

  // An account with no linked Site has nothing for the prompt to read, so the
  // page offers no prompt (UX replay A7).
  it.each([
    ['no Sites', []],
    ['a Site gscdump refused to link', [{ ...LINKED, gscdumpSiteId: null, syncStatus: 'refused' }]],
    ['a held Site', [{ ...LINKED, hold: 'size_limit' }]],
  ] as const)('finds no Site to read with %s', (_case, sites) => {
    expect(agentPromptSite(sites)).toBeNull()
  })

  it('skips a held Site for a linked one', () => {
    const held = { ...LINKED, gscdumpSiteId: 's_held', hold: 'size_pending' } as const
    expect(agentPromptSite([held, { ...LINKED, domain: null, property: 'https://other.dev/' }])).toEqual({ gscdumpSiteId: 's_abc', host: 'https://other.dev/' })
  })
})
