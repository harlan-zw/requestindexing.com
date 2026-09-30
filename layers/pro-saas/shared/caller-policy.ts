// Pure policy helpers over a Caller. No Nuxt auto-imports, no DB. Test surface
// for the user-context seam: construct a Caller literal, assert behaviour.

import type { Caller } from './caller'

export function findMembership(caller: Caller, teamId: number) {
  return caller.memberships.find(m => m.teamId === teamId) ?? null
}
