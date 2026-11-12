// Request Indexing's nav source for the `@nuxtseo/pro-shell` frame: the Site
// roster, the Site in view, the account, the Caller's access, the feature
// flags, and the feedback drawer. The dashboard layout reads the roster and the
// routed Site once and provides this above the frame, so no shell part fetches.
import type { ProShellAccessAdapter } from '@nuxtseo/pro-shell/shared/access'
import type { ProShellNavSource } from '@nuxtseo/pro-shell/shared/nav-source'
import type { Ref } from 'vue'
import type { ProNavSite } from '#layers/pro-features/app/composables/useProSingleSiteNav'
import type { Ability } from '../../shared/policies/team-policy'
import { provideProShellNavSource } from '@nuxtseo/pro-shell/app/composables/useProShellNavSource'
import { ACCESS_ALLOWED, accessDenied } from '@nuxtseo/pro-shell/shared/access'
import { readProFeatureFlags } from '#layers/pro-features/shared/manifest'
import { callerCan } from '../../shared/policies/team-policy'
import { proNavSiteRef, proShellSiteList, toProShellSite } from '../utils/pro-shell-sites'
import { useProFeedback } from './useProFeedback'

/** COPY.md, Dashboard shell assets: the tooltip on an action the Team role refuses. */
export const ACCESS_REFUSED = 'Your Team role does not allow this. Ask a Team admin.'

export interface ProNavSourceInput {
  /** The roster, or null while it loads. */
  readonly sites: Readonly<Ref<readonly ProNavSite[] | null>>
  /** The Site the layout scoped the sidebar to, or null for the fleet. */
  readonly scopedSite: Readonly<Ref<ProNavSite | null>>
  /** The Site reference in the URL, or null outside a Site. */
  readonly routeSiteRef: Readonly<Ref<string | null>>
}

export function provideProNavSource(input: ProNavSourceInput): ProShellNavSource {
  const { session } = useUserSession()
  const { caller } = useCaller()
  const feedback = useProFeedback()
  const flags = computed(() => readProFeatureFlags(useRuntimeConfig().public))

  const access: ProShellAccessAdapter = (ability, teamId) => {
    const id = teamId === null ? caller.value?.currentTeamId : Number(teamId)
    if (!id)
      return accessDenied(ACCESS_REFUSED)
    return callerCan(caller.value ?? null, id, ability as Ability) ? ACCESS_ALLOWED : accessDenied(ACCESS_REFUSED)
  }

  return provideProShellNavSource({
    sites: computed(() => input.sites.value === null
      ? null
      : proShellSiteList(input.sites.value, input.routeSiteRef.value ? input.scopedSite.value : null)),
    groups: computed(() => []),
    currentSite: computed(() => input.scopedSite.value && proNavSiteRef(input.scopedSite.value) ? toProShellSite(input.scopedSite.value) : null),
    routeSiteRef: input.routeSiteRef,
    user: computed(() => session.value?.user
      ? { name: session.value.user.name ?? null, avatarUrl: session.value.user.avatarUrl ?? null }
      : null),
    access,
    hasFeature: feature => (flags.value as Record<string, boolean | undefined>)[feature] === true,
    openFeedback: context => feedback.open(context),
  })
}
