import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { publicFetch } from './public-fetch'
import { resolvePublicHostname } from './public-transport'

const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn() }))
vi.mock('node:dns/promises', () => dns)

const fetchDestination = vi.fn()
function read() {
  return publicFetch('https://public.example/sitemap.xml', {}, {
    resolveHostname: resolvePublicHostname,
    fetchDestination,
  })
}

beforeEach(() => {
  dns.resolve4.mockResolvedValue(['ghs.google.com.', '142.250.66.65'])
  dns.resolve6.mockResolvedValue(['ghs.google.com.', '2404:6800:4006:81d::2001'])
  fetchDestination.mockResolvedValue(new Response('<urlset/>'))
})
afterEach(() => vi.resetAllMocks())

it('fetches the original host through public addresses after Workers CNAME answers', async () => {
  expect(await (await read()).text()).toBe('<urlset/>')
  expect(fetchDestination).toHaveBeenCalledWith(new URL('https://public.example/sitemap.xml'), expect.anything(), { address: '142.250.66.65', family: 4 })
  expect(await resolvePublicHostname('public.example')).toEqual(['142.250.66.65', '2404:6800:4006:81d::2001'])
})

it.each(['127.0.0.1', '10.0.0.1', '::1'])('rejects every private address alongside public answers and aliases: %s', async (address) => {
  // Even an unexpected-family IP must reach publicFetch's network policy.
  dns.resolve4.mockResolvedValue(['ghs.google.com.', '142.250.66.65', address])
  await expect(read()).rejects.toThrow(/Blocked private IPv[46]/)
  expect(fetchDestination).not.toHaveBeenCalled()
})

it('rejects private AAAA answers after an alias', async () => {
  dns.resolve6.mockResolvedValue(['ghs.google.com.', '::1'])
  await expect(read()).rejects.toThrow('Blocked private IPv6')
  expect(fetchDestination).not.toHaveBeenCalled()
})

it('does not fetch when the resolver returns aliases without addresses', async () => {
  dns.resolve4.mockResolvedValue(['ghs.google.com.', 'not-an-address'])
  dns.resolve6.mockResolvedValue(['ghs.google.com.'])
  await expect(read()).rejects.toThrow('DNS returned no public addresses')
  expect(fetchDestination).not.toHaveBeenCalled()
})

it('permits an absent address family while preserving resolver failures', async () => {
  dns.resolve6.mockRejectedValue(Object.assign(new Error('No AAAA records'), { code: 'ENODATA' }))
  expect((await read()).ok).toBe(true)
  fetchDestination.mockClear()
  dns.resolve6.mockRejectedValue(Object.assign(new Error('DNS timed out'), { code: 'ETIMEOUT' }))
  await expect(read()).rejects.toThrow('DNS timed out')
  expect(fetchDestination).not.toHaveBeenCalled()
})
