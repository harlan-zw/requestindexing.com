import { defineProShellConfig } from '@nuxtseo/pro-shell/shared/config'
import { PRO_SHELL_COPY_OVERRIDES, PRO_SHELL_ROUTES } from './pro-shell'

// The `@nuxtseo/pro-shell` seams: where each logical route lives here, the
// words that differ from the shell defaults, and the storage keys this app
// already wrote before it adopted the shell.
export default {
  proShell: defineProShellConfig({
    routes: PRO_SHELL_ROUTES,
    copy: PRO_SHELL_COPY_OVERRIDES,
    nav: {
      // The key the local `ProNavSection` wrote, so no collapsed section reopens.
      collapseStorageKey: 'pro-nav-sections-collapsed',
    },
  }),
}
