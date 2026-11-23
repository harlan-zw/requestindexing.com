import { describe, expect, it } from 'vitest'
import { AGENT_SETUP_ROUTES, buildAgentSetupPrompt, ONBOARDING_SETUP_URL, parseAgentSetupRoute } from './agent-setup'

describe('parseAgentSetupRoute', () => {
  it('reads each agent choice', () => {
    expect(parseAgentSetupRoute('coding-agent')).toBe('coding-agent')
    expect(parseAgentSetupRoute('claude')).toBe('claude')
    expect(parseAgentSetupRoute('chatgpt')).toBe('chatgpt')
  })

  it('reads anything else as no choice', () => {
    expect(parseAgentSetupRoute('codex')).toBeNull()
    expect(parseAgentSetupRoute('')).toBeNull()
    expect(parseAgentSetupRoute(undefined)).toBeNull()
    expect(parseAgentSetupRoute(['claude'])).toBeNull()
  })
})

describe('buildAgentSetupPrompt', () => {
  it.each(AGENT_SETUP_ROUTES)('sends an empty Site list back to Request Indexing on the %s route', (route) => {
    const prompt = buildAgentSetupPrompt(route)
    expect(prompt).toContain(ONBOARDING_SETUP_URL)
    expect(prompt).not.toContain('gscdump.com/app')
  })

  it.each(AGENT_SETUP_ROUTES)('carries no API key on the %s route', (route) => {
    expect(buildAgentSetupPrompt(route)).not.toMatch(/GSCDUMP_API_KEY|x-api-key|--api-key/)
  })

  it('signs the coding agent in through the browser', () => {
    expect(buildAgentSetupPrompt('coding-agent')).toContain('gscdump auth login --mode hosted')
  })
})
