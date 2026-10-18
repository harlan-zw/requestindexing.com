# Published SDK heartbeat adoption

Date: 2026-10-18. Canonical fix: [gscdump PR #234](https://github.com/harlan-zw/gscdump/pull/234). Published release: [v7.3.1](https://github.com/harlan-zw/gscdump/releases/tag/v7.3.1).

Request Indexing adopts the published 7.3.1 family through its catalog pins for `@gscdump/sdk`, `@gscdump/contracts`, `@gscdump/engine` and `gscdump`, with matching exact release-age entries and the transitive lakehouse package. No local SDK patch ships.

Literal pongs now update the active connection's transport liveness before the ordered application frame queue. A slow authoritative read or event effect can no longer cause a false heartbeat disconnect while pongs arrive. JSON frames, effects, cursor persistence and ACKs retain their ordering. Obsolete sockets and genuinely missing pongs still fail appropriately.

The compatibility review found no runtime `classifySiteTriage` or `reachLivenessRatio` use in this app. `SiteTriage` is imported only as a type by an uncalled helper; its health shape remains compatible. Existing v1 HTTP operations and used lifecycle, period, webhook, permission and partner-error APIs remain compatible. Contract additions do not widen the explicit browser-proxy allowlist. The unrelated application and auth source remain unchanged in this adoption.

`tests/gscdump-sdk-heartbeat.test.ts` imports the app's actual runtime facade, which resolves the normal installed `@gscdump/sdk/v1` package export. It covers a pending resync, a delayed effect with ordered effects/cursor saves/ACKs, an obsolete socket's pongs and a genuinely missing pong. The two delayed-work tests fail against unpatched 5.8.0; the control tests pass. The same four tests guard the published 7.3.1 runtime. No source alias or mocked SDK implementation is used.

Validation includes these runtime regressions, the merged session-expiry/realtime integration tests, the browser proxy allowlist, indexing diagnosis, lifecycle and consumer read tests. The normal Linux CI gates lint, typecheck, the full test suite and the production build.

The original generic browser warning remains unattributed. The independently reproduced heartbeat and expired-session defects do not establish its historical cause.
