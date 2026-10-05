<script lang="ts" setup>
import type {
  CheckVerificationResult,
  MintVerificationResult,
  PendingVerification,
  PropertyVerificationState,
  VerificationMethod,
} from '#layers/pro-gsc/shared/property-verification'
import { useClipboard } from '@vueuse/core'
import { withQuery } from 'ufo'
import { computed, onMounted, ref, watch } from 'vue'
import {
  ADD_VERIFY_ACTION,
  ADD_VERIFY_ADDRESS_LABEL,
  ADD_VERIFY_CHANGE_ADDRESS,
  ADD_VERIFY_CHECKING_GRANT,
  ADD_VERIFY_COPY,
  ADD_VERIFY_DNS_FIELDS,
  ADD_VERIFY_DNS_STEP,
  ADD_VERIFY_INTRO,
  ADD_VERIFY_META_STEP,
  ADD_VERIFY_METHOD_LABEL,
  ADD_VERIFY_METHODS,
  ADD_VERIFY_PERMISSION,
  ADD_VERIFY_REFUSED,
  ADD_VERIFY_RETRY_ACTION,
  ADD_VERIFY_TITLE,
  ADD_VERIFY_VERIFIED_TITLE,
  ADD_VERIFY_VERIFY_ACTION,
  ADD_VERIFY_VERIFY_DETAIL,
  ADD_VERIFY_VERIFY_STEP,
  addVerifyActionFor,
  addVerifyDnsSteps,
  addVerifyVerifiedDetail,
  verifyFailedMessage,
} from '#layers/pro-gsc/shared/add-verify-copy'
import {
  VERIFY_GRANT_RETURN_QUERY,
  VERIFY_GRANT_RETURN_VALUE,
} from '#layers/pro-gsc/shared/property-verification'
import ProAbilityGate from '#layers/pro-saas/app/components/pro/team/ProAbilityGate.vue'
import { parseSiteUrlInput } from '#layers/pro-saas/shared/site-url'

// Add and verify a Search Console property, ported from nuxtseo.com
// `layers/pro/gsc/app/components/pro/ProGscAddVerify.vue` (ADR-0074).
//
// (0) Check that the Google grant gscdump holds can add and verify, and ask for
// the permission up front when it cannot. (1) Get a DNS record or a meta tag
// for the address. (2) Add the property and verify it. gscdump does the work;
// the record is the reader's and stays in place without this app.
//
// nuxtseo.com opens this on a Site it already has. Here a Site needs a verified
// property first, so the reader types the address. After verification the
// property shows in the property list, and the reader connects it there,
// through the same ownership check as every other Site.
//
// nuxtseo.com also re-checks a pending record on a schedule. This app does not,
// so the reader selects Check again.

const { domain = null, gscReturnTo, label = null, ariaLabel = null } = defineProps<{
  /** The address to start from: a refused address, or an unverified property. */
  domain?: string | null
  /** The page the Google grant returns to. */
  gscReturnTo: string
  /** The trigger label. Defaults to the Action asset, or the one-address form with `domain`. */
  label?: string | null
  ariaLabel?: string | null
}>()

const emit = defineEmits<{ verified: [property: { domain: string, siteUrl: string }] }>()

const DOMAIN_RETURN_QUERY = 'gsc_verify_domain'

/** One step of the dialog at a time. */
type Step
  = | { _tag: 'CheckingGrant' }
    | { _tag: 'NeedsGrant' }
    | { _tag: 'Choose' }
    /** A record is minted. `notLive` holds the last check Google could not confirm. */
    | { _tag: 'Place', verification: PendingVerification, notLive: string | null }

const toast = useToast()
const route = useRoute()
const { copy, copied } = useClipboard({ legacy: true })

const open = ref(false)
const step = ref<Step>({ _tag: 'CheckingGrant' })
const address = ref(domain ?? '')
const method = ref<VerificationMethod>('DNS_TXT')
const busy = ref<'record' | 'verify' | null>(null)
const error = ref<string | null>(null)
// Set when the reader returns from the `?scope=verify` grant. The grant just
// changed, so it is trusted over the read, as on nuxtseo.com.
const justGranted = ref(false)

const triggerLabel = computed(() => label ?? (domain ? addVerifyActionFor(domain) : ADD_VERIFY_ACTION))

const methodOptions = [
  { value: 'DNS_TXT' as const, label: ADD_VERIFY_METHODS.DNS_TXT.name, icon: 'globe' },
  { value: 'META' as const, label: ADD_VERIFY_METHODS.META.name, icon: 'code' },
]

// The domain carried through the Google round trip, so the dialog reopens on it.
const addressDomain = computed(() => {
  const parsed = parseSiteUrlInput(address.value)
  return parsed._tag === 'Ok' ? parsed.domain : null
})

const grantUrl = computed(() => {
  const back = withQuery(gscReturnTo, {
    [VERIFY_GRANT_RETURN_QUERY]: VERIFY_GRANT_RETURN_VALUE,
    ...(addressDomain.value ? { [DOMAIN_RETURN_QUERY]: addressDomain.value } : {}),
  })
  return `/auth/integrations/gsc/connect?scope=verify&returnTo=${encodeURIComponent(back)}`
})

const place = computed(() => step.value._tag === 'Place' ? step.value : null)
const dnsRecord = computed(() => place.value?.verification.record._tag === 'DnsTxt' ? place.value.verification.record : null)
const metaRecord = computed(() => place.value?.verification.record._tag === 'MetaTag' ? place.value.verification.record : null)
const metaTag = computed(() => metaRecord.value ? `<meta name="google-site-verification" content="${metaRecord.value.content}" />` : '')

function pendingFor(pending: PendingVerification[]): PendingVerification | null {
  const wanted = addressDomain.value
  if (wanted)
    return pending.find(record => record.domain === wanted) ?? null
  return pending[0] ?? null
}

function resume(verification: PendingVerification) {
  method.value = verification.method
  address.value = verification.domain
  step.value = { _tag: 'Place', verification, notLive: null }
}

async function start() {
  error.value = null
  step.value = { _tag: 'CheckingGrant' }
  const state = await $fetch<PropertyVerificationState>('/api/pro/gsc-verification')
    .catch((): PropertyVerificationState => {
      // The read only decides where the dialog opens. Without it the dialog
      // opens on the record step, and a mint that gscdump refuses for the
      // scope still asks for the permission.
      return { grant: { _tag: 'Unknown' }, pending: [] }
    })
  if (state.grant._tag === 'ScopeMissing' && !justGranted.value) {
    step.value = { _tag: 'NeedsGrant' }
    return
  }
  const pending = pendingFor(state.pending)
  if (pending)
    resume(pending)
  else
    step.value = { _tag: 'Choose' }
}

watch(open, (isOpen) => {
  if (isOpen)
    void start()
})

// Resume after the grant: open, confirm, and clear the marker so a reload does
// not replay it. A property row can take only its own address. The general
// Add and verify trigger can resume an address with no property row yet.
const grantReturnTaken = useState('pro-gsc:verify-grant-return-taken', () => false)
onMounted(() => {
  if (route.query[VERIFY_GRANT_RETURN_QUERY] !== VERIFY_GRANT_RETURN_VALUE || grantReturnTaken.value)
    return
  const returnedDomain = route.query[DOMAIN_RETURN_QUERY]
  const returned = typeof returnedDomain === 'string' ? parseSiteUrlInput(returnedDomain) : null
  const target = domain ? parseSiteUrlInput(domain) : null
  if (domain && (returned?._tag !== 'Ok' || target?._tag !== 'Ok' || target.domain !== returned.domain))
    return
  grantReturnTaken.value = true
  justGranted.value = true
  if (returned?._tag === 'Ok')
    address.value = returned.domain
  open.value = true
  toast.add({ title: ADD_VERIFY_PERMISSION.grantedTitle, description: ADD_VERIFY_PERMISSION.grantedDetail, color: 'success' })
  const { [VERIFY_GRANT_RETURN_QUERY]: _granted, [DOMAIN_RETURN_QUERY]: _domain, ...rest } = route.query
  void navigateTo({ path: route.path, query: rest }, { replace: true })
})

async function getRecord() {
  error.value = null
  busy.value = 'record'
  const result = await $fetch<MintVerificationResult>('/api/pro/gsc-verification/record', {
    method: 'POST',
    body: { address: address.value, method: method.value },
  }).catch((): MintVerificationResult => ({ _tag: 'Refused', refusal: { reason: 'unavailable', message: ADD_VERIFY_REFUSED.record } }))
  busy.value = null
  if (result._tag === 'Minted')
    step.value = { _tag: 'Place', verification: result.verification, notLive: null }
  else if (result._tag === 'ScopeMissing')
    step.value = { _tag: 'NeedsGrant' }
  else
    error.value = result.refusal.message
}

async function verify() {
  const current = place.value
  if (!current)
    return
  const { verification } = current
  error.value = null
  busy.value = 'verify'
  // The property URL repeats the minted target exactly, `www.` included.
  const result = await $fetch<CheckVerificationResult>('/api/pro/gsc-verification/verify', {
    method: 'POST',
    body: { address: verification.siteUrl, method: verification.method },
  }).catch((): CheckVerificationResult => ({ _tag: 'Refused', refusal: { reason: 'unavailable', message: verifyFailedMessage(verification.domain) } }))
  busy.value = null

  switch (result._tag) {
    case 'Verified':
      toast.add({ title: ADD_VERIFY_VERIFIED_TITLE, description: addVerifyVerifiedDetail(result.domain), color: 'success' })
      open.value = false
      emit('verified', { domain: result.domain, siteUrl: result.siteUrl })
      // The server read Google's list live, so a stored read now holds the
      // property. These are the two keys that list properties.
      await refreshNuxtData(['pro:gsc-properties', 'site-add-form-gsc-properties'])
      return
    case 'NotLive':
      step.value = { _tag: 'Place', verification, notLive: result.message }
      return
    case 'ScopeMissing':
      step.value = { _tag: 'NeedsGrant' }
      return
    case 'Refused':
      error.value = result.refusal.message
  }
}

function switchMethod() {
  method.value = method.value === 'DNS_TXT' ? 'META' : 'DNS_TXT'
  error.value = null
  step.value = { _tag: 'Choose' }
}

function changeAddress() {
  error.value = null
  step.value = { _tag: 'Choose' }
}

function reset() {
  step.value = { _tag: 'CheckingGrant' }
  address.value = domain ?? ''
  method.value = 'DNS_TXT'
  error.value = null
  busy.value = null
  justGranted.value = false
}
</script>

<template>
  <div>
    <ProAbilityGate ability="manage-sites">
      <UiButton
        purpose="secondary"
        icon="google"
        class="min-h-11"
        :label="triggerLabel"
        :aria-label="ariaLabel ?? undefined"
        aria-haspopup="dialog"
        @click="open = true"
      />
    </ProAbilityGate>

    <UModal
      v-model:open="open"
      :title="ADD_VERIFY_TITLE"
      :ui="{ header: 'pr-14 sm:pr-14', wrapper: 'min-w-0', title: 'break-words', footer: 'justify-end' }"
      @after:leave="reset"
    >
      <template #body>
        <div class="space-y-4" data-testid="gsc-add-verify">
          <p class="text-sm text-muted">
            {{ ADD_VERIFY_INTRO }}
          </p>

          <UiSyncDot v-if="step._tag === 'CheckingGrant'" status="syncing" :label="ADD_VERIFY_CHECKING_GRANT" />

          <UiAlert
            v-else-if="step._tag === 'NeedsGrant'"
            status="info"
            icon="shield"
            :title="ADD_VERIFY_PERMISSION.title"
            :description="ADD_VERIFY_PERMISSION.detail"
          >
            <template #action>
              <UiButton size="xs" purpose="cta" icon="google" :to="grantUrl" external :label="ADD_VERIFY_PERMISSION.action" />
            </template>
          </UiAlert>

          <form v-else-if="step._tag === 'Choose'" class="space-y-4" @submit.prevent="getRecord">
            <UFormField :label="ADD_VERIFY_ADDRESS_LABEL">
              <UInput
                v-model="address"
                placeholder="example.com"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                class="w-full"
              />
            </UFormField>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-medium text-highlighted">{{ ADD_VERIFY_METHOD_LABEL }}</span>
                <UiTogglePill v-model="method" :options="methodOptions" :label="ADD_VERIFY_METHOD_LABEL" />
              </div>
              <p class="text-xs text-muted">
                {{ ADD_VERIFY_METHODS[method].help }}
              </p>
            </div>
            <UiButton
              type="submit"
              purpose="secondary"
              :icon="method === 'DNS_TXT' ? 'globe' : 'code'"
              class="min-h-11"
              :loading="busy === 'record'"
              :disabled="!address.trim() || busy !== null"
              :label="ADD_VERIFY_METHODS[method].getRecord"
            />
          </form>

          <template v-else-if="place">
            <UiButton
              v-if="!domain"
              purpose="quiet"
              class="min-h-11"
              :disabled="busy !== null"
              :label="ADD_VERIFY_CHANGE_ADDRESS"
              @click="changeAddress"
            />
            <div v-if="dnsRecord" class="space-y-2">
              <p class="text-sm font-medium text-highlighted">
                {{ ADD_VERIFY_DNS_STEP }}
              </p>
              <dl class="divide-y divide-default rounded-lg border border-default bg-muted text-xs">
                <div class="flex items-center justify-between gap-2 p-2.5">
                  <dt class="text-dimmed">
                    {{ ADD_VERIFY_DNS_FIELDS.type }}
                  </dt>
                  <dd class="font-mono">
                    TXT
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-2 p-2.5">
                  <dt class="shrink-0 text-dimmed">
                    {{ ADD_VERIFY_DNS_FIELDS.name }}
                  </dt>
                  <dd class="truncate font-mono">
                    {{ dnsRecord.name }}
                  </dd>
                </div>
                <div class="flex items-center gap-2 p-2.5">
                  <dt class="shrink-0 text-dimmed">
                    {{ ADD_VERIFY_DNS_FIELDS.value }}
                  </dt>
                  <dd class="min-w-0 flex-1 truncate font-mono" data-testid="gsc-verify-record">
                    {{ dnsRecord.value }}
                  </dd>
                  <UiButton
                    size="xs"
                    purpose="quiet"
                    :icon="copied ? 'check' : 'copy'"
                    :aria-label="copied ? ADD_VERIFY_COPY.copied : ADD_VERIFY_COPY.copy"
                    @click="copy(dnsRecord.value)"
                  />
                </div>
              </dl>
              <ol class="list-decimal space-y-1 pl-5 text-xs text-muted">
                <li v-for="line in addVerifyDnsSteps(place.verification.domain)" :key="line">
                  {{ line }}
                </li>
              </ol>
            </div>

            <div v-else-if="metaRecord" class="space-y-2">
              <p class="text-sm font-medium text-highlighted">
                {{ ADD_VERIFY_META_STEP }}
              </p>
              <div class="flex items-center gap-2 rounded-lg border border-default bg-muted p-2.5 text-xs">
                <code class="min-w-0 flex-1 break-all font-mono" data-testid="gsc-verify-record">{{ metaTag }}</code>
                <UiButton
                  size="xs"
                  purpose="quiet"
                  :icon="copied ? 'check' : 'copy'"
                  :aria-label="copied ? ADD_VERIFY_COPY.copied : ADD_VERIFY_COPY.copy"
                  @click="copy(metaTag)"
                />
              </div>
              <p class="break-all font-mono text-xs text-dimmed">
                {{ metaRecord.pageUrl }}
              </p>
            </div>

            <div class="space-y-1">
              <p class="text-sm font-medium text-highlighted">
                {{ ADD_VERIFY_VERIFY_STEP }}
              </p>
              <p class="text-xs text-muted">
                {{ ADD_VERIFY_VERIFY_DETAIL }}
              </p>
            </div>

            <UiAlert v-if="place.notLive" status="warning" :title="place.notLive" />

            <UiButton
              purpose="quiet"
              size="xs"
              icon="back"
              :label="ADD_VERIFY_METHODS[method === 'DNS_TXT' ? 'META' : 'DNS_TXT'].switchTo"
              @click="switchMethod"
            />
          </template>

          <UiAlert v-if="error" status="error" icon="caution" :title="error" />
        </div>
      </template>

      <template #footer>
        <UiButton purpose="quiet" label="Cancel" @click="open = false" />
        <UiButton
          v-if="place"
          purpose="cta"
          icon="success"
          :loading="busy === 'verify'"
          :disabled="busy !== null"
          :label="place.notLive ? ADD_VERIFY_RETRY_ACTION : ADD_VERIFY_VERIFY_ACTION"
          @click="verify"
        />
      </template>
    </UModal>
  </div>
</template>
