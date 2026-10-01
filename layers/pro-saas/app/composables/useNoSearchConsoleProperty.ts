import type { MaybeRefOrGetter } from 'vue'
import type { PropertyPickerResponse } from '#layers/pro-gsc/shared/property-picker'
import { computed, toValue } from 'vue'
import { projectPropertyPicker } from '#layers/pro-gsc/shared/property-picker'

const NO_CONNECTED_DOMAINS: ReadonlySet<string> = new Set()

/**
 * Whether the reader's Google account holds no Search Console property, for a
 * page that offers Connect a Site because no Site is connected.
 *
 * The answer comes from the property list projection PR #181 added
 * (`projectPropertyPicker`), which Connect a Site reads too, so the two can
 * never disagree. Only a read that returns no property at all answers true.
 * While the list loads, or when the read fails, the page keeps its Connect a
 * Site prompt, and Connect a Site states the failure.
 *
 * `active` is the page's own no-Site condition. The read runs only while it
 * holds and Search Console is connected, so a page with Sites never pays for
 * it. The key is the one Integrations reads, so the two pages share one read.
 */
export function useNoSearchConsoleProperty(active: MaybeRefOrGetter<boolean>) {
  const { session } = useUserSession()
  const enabled = computed(() => toValue(active) && !!session.value?.gscConnected)

  const { data, status } = useLazyFetch<PropertyPickerResponse>('/api/pro/gsc-properties', {
    key: 'pro:gsc-properties',
    server: false,
    enabled,
  })

  return computed(() => enabled.value && projectPropertyPicker({
    queryStatus: status.value,
    data: data.value,
    connectedDomains: NO_CONNECTED_DOMAINS,
  })._tag === 'NoProperties')
}
