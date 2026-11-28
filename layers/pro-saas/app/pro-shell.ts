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
  siteBingIndexing: '/pro/dashboard/sites/[site]/webmaster-tools/crawl',
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
  sidebarModes: {
    backLabel: 'Team navigation',
  },
  fleetSites: {
    sparkTitle: 'Clicks, last 90 days',
    previousPage: 'Previous page of Sites',
    nextPage: 'Next page of Sites',
  },
  userMenu: {
    fallbackName: 'Account',
    switchTitle: 'Switch Team?',
    switchBody: 'Switching to {workspace} leaves the current Site. Unsaved filters on this page are lost.',
    switchConfirm: 'Switch Team',
  },
  setupOffers: {
    heading: 'Next steps',
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
      'agent': {
        label: 'Agent setup',
        title: 'Choose your agent',
        description: 'You confirm each sign-in in your browser.',
      },
      'help': {
        label: 'About you',
      },
      'connect': {
        label: 'Connect Google',
        title: 'Connect Google Search Console',
        description: 'See which pages Google indexed and the reasons it gives for pages it left out.',
      },
      'sites': {
        label: 'Connect Sites',
        title: 'Connect your Sites',
        description: 'Choose the Search Console property for the Site you want to connect.',
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

/**
 * Request Indexing's own setup offers, beside the shell's Bing and Connect
 * another Site offers. The shell's agent skill, MCP and API offers do not show:
 * agent users go to gscdump (MARKETING.md), and the user menu still links the
 * Developers page.
 */
export const REQUEST_INDEXING_SETUP_OFFER_COPY = {
  betaFeedback: {
    title: 'Help improve Request Indexing',
    body: 'What’s missing or getting in your way?',
  },
  indexNow: {
    title: 'Send pages with IndexNow',
    body: 'Publish your key file and verify it. Request Indexing then sends new and changed sitemap URLs to Bing and other participating search engines.',
    cta: 'Set up IndexNow',
  },
  watchedUrls: {
    title: 'Watch your first URLs',
    body: 'Keep scheduled URL Inspection evidence for pages you choose. This does not request indexing.',
    cta: 'Open Watched URLs',
  },
} as const
