import { z } from 'zod'

export const teamNameSchema = z.string().trim().min(1).max(60)
export const teamCreateSchema = z.object({ name: teamNameSchema })
export const teamUpdateSchema = z.object({ name: teamNameSchema })
export const teamRoleSchema = z.enum(['admin', 'editor', 'viewer'])
export const teamMemberRoleUpdateSchema = z.object({ role: teamRoleSchema })
export const teamTransferOwnershipSchema = z.object({ newOwnerUserId: z.string().min(1) })

// Persist the team's selected Search Console sites.
//
// This bound is a payload sanity ceiling, not a product limit. Selecting moves
// Sites the caller already has onto the Team, so it creates no Site and the
// Free allowance does not apply. gscdump owns that ceiling and refuses a new
// Site when it registers.
export const teamSelectedSitesSchema = z.array(z.string().min(1)).max(100, 'Too many sites in one request')
export const teamSitesUpdateSchema = z.object({
  backupsEnabled: z.boolean().optional(),
  selectedSites: teamSelectedSitesSchema.default([]),
})
