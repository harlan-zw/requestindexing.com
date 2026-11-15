import { defineProShellConfig } from '@nuxtseo/pro-shell/shared/config'
import { PRO_SHELL_COPY_OVERRIDES, PRO_SHELL_ROUTES } from './pro-shell'

// The `@nuxtseo/pro-shell` seams: where each logical route lives here, the
// words that differ from the shell defaults, and the nav collapse cookie.
export default {
  proShell: defineProShellConfig({
    routes: PRO_SHELL_ROUTES,
    copy: PRO_SHELL_COPY_OVERRIDES,
    nav: {
      // The cookie that keeps a collapsed nav section closed, so the server
      // draws it closed too.
      collapseStorageKey: 'pro-nav-sections-collapsed',
    },
  }),
}
