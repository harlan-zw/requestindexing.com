import { createError } from 'h3'
import { logWarn } from '~~/shared/logging'

interface Registration { siteId: string, requestedUrl: string }
interface LinkedSite { localSiteId: string, domain: string | null, property: string, teamPrincipalId: string | null, sitePrincipalId: string | null }

function registeredHost(value: string): string | null {
  const input = value.replace(/^sc-domain:/, '')
  const parsed = URL.parse(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  return parsed?.hostname && !parsed.username && !parsed.password ? parsed.hostname : null
}

/** A local link grants access only to the exact host in the authoritative registration. */
export async function assertRegisteredGscSiteScope(
  siteId: string,
  linkedSites: readonly LinkedSite[],
  readLifecycle: (principalId: string) => Promise<{ sites: readonly Registration[] }>,
): Promise<void> {
  const principals = [...new Set(linkedSites.flatMap(site => [site.teamPrincipalId, site.sitePrincipalId]).filter((id): id is string => !!id))]
  const registrations: Registration[] = []
  for (let offset = 0; offset < principals.length; offset += 4) {
    await Promise.all(principals.slice(offset, offset + 4).map(async (principalId) => {
      const lifecycle = await readLifecycle(principalId).catch((error: unknown) => {
        logWarn('gscdump.site_access.read_failed', error, { principalId, gscdumpSiteId: siteId })
        return null
      })
      registrations.push(...(lifecycle?.sites ?? []))
    }))
  }
  const matching = registrations.filter(site => site.siteId === siteId)
  const hosts = new Set(matching.map(site => registeredHost(site.requestedUrl)))
  const registered = hosts.size === 1 ? hosts.values().next().value : null
  const localHosts = linkedSites.map(site => registeredHost(site.domain ?? site.property))
  if (!registered || !localHosts.length || localHosts.some(host => !host)) {
    throw createError({ statusCode: 503, statusMessage: 'gsc_site_scope_unavailable' })
  }
  if (localHosts.some(host => host !== registered)) {
    throw createError({ statusCode: 403, statusMessage: 'gsc_site_host_mismatch' })
  }
}
