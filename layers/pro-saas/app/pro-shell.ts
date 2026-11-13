// Request Indexing's binding of `@nuxtseo/pro-shell`: the route map and the
// copy overrides app.config reads. COPY.md ("Dashboard shell assets") owns
// every string here; change it there first.
//
// This file sits under `app/`, not `shared/`. Nuxt externalizes the app's own
// `shared/` directory from the server build, so an app.config import from
// there resolves one level too high in Nitro (nuxtseo.com #2107).
import type { ProShellAppConfig } from '@nuxtseo/pro-shell/shared/config'

export const PRO_SHELL_ROUTES = {
  dashboard: '/pro/dashboard',
  sites: '/pro/dashboard/sites',
  addSite: '/pro/dashboard/sites/connect',
  teamMembers: '/pro/dashboard/team/members',
  developers: '/pro/dashboard/developers',
  integrations: '/pro/dashboard/integrations',
  bingIntegration: '/pro/dashboard/integrations#bing',
  onboarding: '/pro/dashboard/onboarding',
  // Search Console connects on Integrations. Account keeps only the sign-in.
  searchConsole: '/pro/dashboard/integrations',
  siteOverview: '/pro/dashboard/sites/[site]',
  siteIndexing: '/pro/dashboard/sites/[site]/indexing',
  siteSearchConsole: '/pro/dashboard/sites/[site]/search-console',
  siteBingIndexing: '/pro/dashboard/sites/[site]/indexing/bing',
} as const satisfies NonNullable<ProShellAppConfig['routes']>

export const PRO_SHELL_COPY_OVERRIDES = {
  frame: {
    brandLabel: 'Request Indexing dashboard',
  },
  siteSwitcher: {
    allSites: 'All Sites',
    switchLabel: 'Switch Site, current Site: {site}',
    preview: 'Non-production Site.',
  },
  userMenu: {
    fallbackName: 'Account',
    switchTitle: 'Switch Team?',
    switchBody: 'Switching to {workspace} leaves the current Site. Unsaved filters on this page are lost.',
    switchConfirm: 'Switch Team',
  },
  setupOffers: {
    skill: {
      body: 'Let your coding agent read your indexing record through the gscdump CLI.',
    },
    mcp: {
      body: 'Read your Search Console data from hosted AI clients.',
    },
    api: {
      body: 'Call the gscdump HTTP API with an API key.',
    },
    bing: {
      title: 'Connect Bing Webmaster Tools',
      siteBody: 'Read Bing crawl evidence for this Site.',
      fleetBody: 'Connect Bing once, then link each Site to read its Bing crawl evidence.',
    },
    anotherSite: {
      title: 'Connect another Site',
      body: 'See which pages Google has indexed on more of your Sites.',
      cta: 'Connect a Site',
    },
  },
  invite: {
    action: 'Invite member',
    title: 'Invite a member',
    roleLabel: 'Role',
    sentTitle: 'Invitation created',
    sentDescription: 'Pending invitations shows its link and whether the email was sent.',
    resentTitle: 'Invitation renewed',
    resentDescription: 'The previous link stopped working. Pending invitations shows the new link and whether the email was sent.',
  },
  onboarding: {
    progressLabel: 'Setup progress',
    steps: {
      'connect': {
        label: 'Connect Google',
        title: 'Connect Google Search Console',
        description: 'Request Indexing reads your Search Console data to find pages Google has missed, then submits them for you.',
      },
      'sites': {
        label: 'Connect Sites',
        title: 'Connect your Sites',
        description: 'Choose a property from your Search Console. Request Indexing reads each Site from its property.',
      },
      'sync': {
        label: 'Finish setup',
        cta: 'Go to dashboard',
      },
      'connect-site': {
        title: 'Connect your first Site',
        description: 'Connect a Site to see which of its pages Google has indexed, and why the rest are not.',
        cta: 'Connect a Site',
      },
      'connect-search-console': {
        title: 'Connect Google Search Console',
        description: 'Indexing status and coverage for your Sites come from Search Console. We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify.',
      },
    },
  },
} as const satisfies NonNullable<ProShellAppConfig['copy']>
