export function registeredHost(value: string): string | null {
  const input = value.replace(/^sc-domain:/, '')
  const parsed = URL.parse(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  return parsed?.hostname && !parsed.username && !parsed.password ? parsed.hostname : null
}

/** An authoritative registration must describe the local Site's exact host. */
export function registeredSiteHostMatches(requestedUrl: string, expectedSiteUrl: string): boolean {
  const registered = registeredHost(requestedUrl)
  return registered !== null && registered === registeredHost(expectedSiteUrl)
}
