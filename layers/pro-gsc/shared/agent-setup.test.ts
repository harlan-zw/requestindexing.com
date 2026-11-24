import { describe, expect, it } from 'vitest'
import { AGENT_SETUP_ROUTES, agentSetupSteps, buildAgentSetupPrompt, ONBOARDING_SETUP_URL, parseAgentSetupRoute } from './agent-setup'

describe('parseAgentSetupRoute', () => {
  it('reads each agent choice', () => {
    expect(parseAgentSetupRoute('coding-agent')).toBe('coding-agent')
    expect(parseAgentSetupRoute('claude')).toBe('claude')
    expect(parseAgentSetupRoute('chatgpt')).toBe('chatgpt')
    expect(parseAgentSetupRoute('gemini')).toBe('gemini')
  })

  it('reads anything else as no choice', () => {
    expect(parseAgentSetupRoute('codex')).toBeNull()
    expect(parseAgentSetupRoute('')).toBeNull()
    expect(parseAgentSetupRoute(undefined)).toBeNull()
    expect(parseAgentSetupRoute(['claude'])).toBeNull()
  })
})

describe('buildAgentSetupPrompt', () => {
  it.each(AGENT_SETUP_ROUTES)('sends an empty Site list back to setup on the %s route during onboarding', (route) => {
    const prompt = buildAgentSetupPrompt(route, 'onboarding')
    expect(prompt).toContain(ONBOARDING_SETUP_URL)
    expect(prompt).not.toContain('gscdump.com/app')
  })

  // Only a reader who finished setup reaches Developers, and the wizard
  // redirects them to the dashboard. Connect a Site is open to them.
  it.each(AGENT_SETUP_ROUTES)('sends an empty Site list to Connect a Site on the %s route on Developers', (route) => {
    const prompt = buildAgentSetupPrompt(route, 'developers')
    expect(prompt).toContain('Tell me to connect a Site at https://requestindexing.com/pro/dashboard/sites/connect')
    expect(prompt).not.toContain(ONBOARDING_SETUP_URL)
    expect(prompt).not.toContain('gscdump.com/app')
  })

  it.each(AGENT_SETUP_ROUTES)('carries no API key on the %s route', (route) => {
    for (const place of ['onboarding', 'developers'] as const)
      expect(buildAgentSetupPrompt(route, place)).not.toMatch(/GSCDUMP_API_KEY|x-api-key|--api-key/)
  })

  it.each(AGENT_SETUP_ROUTES)('lets the reader choose the Site on the %s route', (route) => {
    // gscdump can hold its own Site for the same property, so a list of one
    // may still be the wrong Site.
    expect(buildAgentSetupPrompt(route, 'onboarding')).toContain('Ask me which Site to read')
    expect(buildAgentSetupPrompt(route, 'onboarding')).not.toContain('the only Site')
  })

  it('signs the coding agent in through the browser', () => {
    expect(buildAgentSetupPrompt('coding-agent', 'developers')).toContain('gscdump auth login --mode hosted')
  })
})

describe('agentSetupSteps', () => {
  it.each(AGENT_SETUP_ROUTES)('names the Google account that owns the property on the %s approval step', (route) => {
    // gscdump finds its account by Google account. Another account sees no Site.
    const approve = agentSetupSteps(route).find(step => step.key === 'approve')
    expect(approve?.detail).toContain('the Google account that owns your Search Console property')
  })

  it('links ChatGPT to the setup steps on gscdump.com, never a path on this app', () => {
    const add = agentSetupSteps('chatgpt')[0]?.action
    expect(add).toEqual({ _tag: 'Link', label: 'Open setup steps', to: 'https://gscdump.com/mcp/chatgpt' })
  })

  it('gives Gemini the gscdump MCP URL to enter as a custom app', () => {
    // Gemini has no gscdump listing. The reader adds gscdump by URL.
    const add = agentSetupSteps('gemini')[0]
    expect(add?.paste).toBe('https://gscdump.com/mcp')
    expect(add?.action).toEqual({ _tag: 'Link', label: 'Open Gemini', to: 'https://gemini.google.com/' })
  })
})
