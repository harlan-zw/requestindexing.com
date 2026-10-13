export function resolveCheckinDeployment(version: { tag?: string, id?: string } | undefined) {
  const tag = version?.tag?.trim()
  return (tag === 'public-egress-v1' ? undefined : tag) || version?.id?.trim() || 'unknown'
}
