export interface ProSaasFeatures {
  accountDeletion: boolean
  api: boolean
  feedback: boolean
  githubSignIn: boolean
  googleSignIn: boolean
  invitations: boolean
  onboarding: boolean
  profilePhotos: boolean
  teams: boolean
}

export const defaultProSaasFeatures = {
  accountDeletion: true,
  api: true,
  feedback: false,
  // Off until production has a GitHub OAuth client. nuxtseo.com turns it on,
  // but Request Indexing never set `NUXT_OAUTH_GITHUB_CLIENT_ID` or `_SECRET`:
  // every "Continue with GitHub" ended on /login with those variable names in
  // the error, and no account has a GitHub identity. Set both secrets, then
  // turn this on. A GitHub-only account still needs Google for Search Console;
  // the wizard's first step tells it so.
  githubSignIn: false,
  googleSignIn: true,
  invitations: true,
  onboarding: true,
  profilePhotos: false,
  teams: true,
} as const satisfies ProSaasFeatures

export type ProSaasFeature = keyof ProSaasFeatures

export function resolveProSaasFeatures(overrides: Partial<ProSaasFeatures> = {}): ProSaasFeatures {
  return { ...defaultProSaasFeatures, ...overrides }
}

export function proSaasFeatureEnabled(
  features: Partial<ProSaasFeatures> | undefined,
  feature: ProSaasFeature,
): boolean {
  return resolveProSaasFeatures(features)[feature]
}
