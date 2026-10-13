export function resolveCheckinDeployment(version: { tag?: string, id?: string } | undefined) {
  return version?.tag?.trim() || version?.id?.trim() || 'unknown'
}
