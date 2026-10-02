// The words of Add and verify, the dialog that adds a Search Console property
// to the reader's Google account and verifies it.
//
// Ported from nuxtseo.com `layers/pro/gsc/app/components/pro/ProGscAddVerify.vue`
// (ADR-0074). COPY.md ("Add and verify assets") is canonical: change a string
// there first, then here.

export const ADD_VERIFY_ACTION = 'Add and verify a property'

/** "Action for one address": beside a refused address on Connect a Site. */
export function addVerifyActionFor(domain: string): string {
  return `Add and verify ${domain}`
}

export const ADD_VERIFY_TITLE = 'Add and verify a Search Console property'
export const ADD_VERIFY_INTRO = 'Search Console adds a property when you prove that you own the site. Add a DNS record or a meta tag, then verify it. The record is yours, so the property stays verified if you stop using Request Indexing.'
export const ADD_VERIFY_CHECKING_GRANT = 'Checking your Google permissions.'

export const ADD_VERIFY_PERMISSION = {
  title: 'One more Google permission',
  detail: 'Request Indexing needs permission to add and verify sites in your Search Console. Google asks once, then sends you back here.',
  action: 'Grant permission',
  grantedTitle: 'Google permission granted',
  grantedDetail: 'You can now add and verify a Search Console property.',
} as const

export const ADD_VERIFY_ADDRESS_LABEL = 'Site address'
export const ADD_VERIFY_METHOD_LABEL = 'Method'

export const ADD_VERIFY_METHODS = {
  DNS_TXT: {
    name: 'DNS record',
    help: 'Verifies the domain and every subdomain. Search Console adds it as a Domain property.',
    getRecord: 'Get DNS record',
    switchTo: 'Use a DNS record instead',
  },
  META: {
    name: 'Meta tag',
    help: 'Verifies this one address. Search Console adds it as a URL-prefix property.',
    getRecord: 'Get meta tag',
    switchTo: 'Use a meta tag instead',
  },
} as const

export const ADD_VERIFY_DNS_STEP = '1. Add this TXT record at your DNS provider'
export const ADD_VERIFY_DNS_FIELDS = { type: 'Type', name: 'Name', value: 'Value' } as const

/** "DNS steps": generic, because this app does not detect the DNS provider. */
export function addVerifyDnsSteps(domain: string): string[] {
  return [
    `Sign in where you manage DNS for ${domain}. This is often the company where you bought the domain.`,
    `Add a TXT record with the name and value above. If the name field does not accept ${domain}, type @.`,
    'Save the record. A DNS change can take minutes or hours to go live.',
  ]
}

export const ADD_VERIFY_META_STEP = '1. Add this tag to the head of your home page, then deploy'
export const ADD_VERIFY_VERIFY_STEP = '2. Verify ownership'
export const ADD_VERIFY_VERIFY_DETAIL = 'When the record is live, select Verify ownership. If you leave now, Request Indexing keeps the record, and you can verify it later.'
export const ADD_VERIFY_VERIFY_ACTION = 'Verify ownership'
export const ADD_VERIFY_RETRY_ACTION = 'Check again'
export const ADD_VERIFY_COPY = { copy: 'Copy value', copied: 'Copied' } as const

export const ADD_VERIFY_VERIFIED_TITLE = 'Property verified'
export function addVerifyVerifiedDetail(domain: string): string {
  return `${domain} is verified in Search Console. Connect it as a Site from your Search Console properties.`
}

export function notLiveDnsMessage(domain: string): string {
  return `Google could not find the TXT record for ${domain} yet. A DNS change can take minutes or hours to go live. Check again later.`
}

export function notLiveMetaMessage(url: string): string {
  return `Google could not find the meta tag on ${url} yet. Deploy the change, then check again.`
}

export const ADD_VERIFY_REFUSED = {
  notConnected: 'Connect Google before you add and verify a property.',
  localhost: 'Google cannot reach a localhost address. Type the public address of your site.',
  apiDisabled: 'Request Indexing cannot reach Google Site Verification right now. Add and verify the property in Search Console instead.',
  record: 'Request Indexing could not get a verification record from Google. Try again in a minute.',
} as const

export function verifyFailedMessage(domain: string): string {
  return `Request Indexing could not reach Google to verify ${domain}. Try again in a minute.`
}
