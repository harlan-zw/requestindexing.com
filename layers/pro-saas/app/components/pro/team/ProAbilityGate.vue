<script setup lang="ts">
import type { Ability } from '../../../../shared/policies/team-policy'

const props = defineProps<{
  ability: Ability
  /**
   * - `tooltip` (default): render slot disabled with a tooltip explaining the limitation.
   *   Use for primary mutations (Connect a Site, Invite member). It keeps them discoverable.
   * - `hide`: render nothing. Use for destructive actions (delete team, transfer) and
   *   anywhere the slot would read as "broken UI" if disabled.
   */
  mode?: 'tooltip' | 'hide'
  tooltipText?: string
}>()

const { currentTeamId } = useCurrentWorkspace()
const policy = useTeamPolicy(currentTeamId)
const allowed = computed(() => policy.can(props.ability))

const defaultTooltips: Record<Ability, string> = {
  'manage-team': 'Only admins can change team settings',
  'manage-members': 'Only admins can manage members',
  'manage-sites': 'Your role cannot connect or edit Sites. Ask an admin.',
  'write-data': 'Your role is read-only. Ask an admin to make changes.',
  'read-data': 'You don\'t have access to this data',
  'transfer-ownership': 'Only the team owner can transfer ownership',
  'delete-team': 'Only the team owner can delete the team',
}

const tooltip = computed(() => props.tooltipText ?? defaultTooltips[props.ability])
const mode = computed(() => props.mode ?? 'tooltip')
</script>

<template>
  <slot v-if="allowed" />
  <template v-else-if="mode === 'tooltip'">
    <UTooltip :text="tooltip">
      <div class="inline-block opacity-50 pointer-events-none" aria-disabled="true">
        <slot />
      </div>
    </UTooltip>
  </template>
  <!-- mode === 'hide' renders nothing -->
</template>
