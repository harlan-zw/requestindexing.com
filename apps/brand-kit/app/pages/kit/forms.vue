<script setup lang="ts">
definePageMeta({ layout: 'kit' })
useHead({ title: 'Forms · Brand Kit' })

const radioValue = ref('email')
const switchValue = ref(true)
const checkValues = ref(['indexed'])
const sliderValue = ref([25])
const selectValue = ref()
const selectMenuValue = ref()
const inputValue = ref('')
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Components"
      title="Forms"
      description="Inputs rest on bg-muted with ring-default, focusing into a primary ring."
    />

    <KitSection title="Text & numeric inputs">
      <UCard variant="outline">
        <div class="grid md:grid-cols-2 gap-5">
          <UFormField label="URL" description="The page to submit for indexing" required>
            <UInput v-model="inputValue" placeholder="https://example.com/post" icon="i-lucide-link" />
          </UFormField>
          <UFormField label="Email">
            <UInput type="email" placeholder="you@example.com" icon="i-lucide-mail" />
          </UFormField>
          <UFormField label="Password">
            <UInput type="password" placeholder="••••••••" icon="i-lucide-lock" />
          </UFormField>
          <UFormField label="Search">
            <UInput placeholder="Search keywords" icon="i-lucide-search" trailing-icon="i-lucide-arrow-right" />
          </UFormField>
          <UFormField label="Number">
            <UInput type="number" placeholder="100" />
          </UFormField>
          <UFormField label="Disabled">
            <UInput disabled placeholder="Read only" />
          </UFormField>
          <UFormField label="With error" error="URL must be absolute">
            <UInput model-value="example.com" />
          </UFormField>
          <UFormField label="Textarea" hint="Optional context">
            <UTextarea :rows="3" placeholder="Notes for the batch" />
          </UFormField>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Selects">
      <UCard variant="outline">
        <div class="grid md:grid-cols-2 gap-5">
          <UFormField label="USelect">
            <USelect
              v-model="selectValue"
              :items="[
                { label: 'United States', value: 'us' },
                { label: 'Germany', value: 'de' },
                { label: 'Australia', value: 'au' },
                { label: 'Japan', value: 'jp' },
              ]"
              placeholder="Pick a country"
            />
          </UFormField>
          <UFormField label="USelectMenu" hint="Searchable">
            <USelectMenu
              v-model="selectMenuValue"
              :items="['Performance', 'Accessibility', 'SEO', 'Best practices']"
              placeholder="Pick a metric"
            />
          </UFormField>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Toggles">
      <UCard variant="outline">
        <div class="grid md:grid-cols-2 gap-5">
          <UFormField label="USwitch">
            <USwitch v-model="switchValue" label="Notify when indexed" />
          </UFormField>
          <UFormField label="UCheckbox group">
            <UCheckboxGroup
              v-model="checkValues"
              :items="[
                { label: 'Indexed', value: 'indexed' },
                { label: 'Discovered', value: 'discovered' },
                { label: 'Excluded', value: 'excluded' },
              ]"
            />
          </UFormField>
          <UFormField label="URadioGroup">
            <URadioGroup
              v-model="radioValue"
              :items="[
                { label: 'Email digest', value: 'email' },
                { label: 'Webhook', value: 'webhook' },
                { label: 'Quiet — dashboard only', value: 'quiet' },
              ]"
            />
          </UFormField>
          <UFormField label="USlider">
            <USlider v-model="sliderValue" :min="0" :max="100" />
            <template #help>
              {{ sliderValue[0] }} pages / day
            </template>
          </UFormField>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Form composition">
      <UCard variant="outline">
        <form class="space-y-5 max-w-md" @submit.prevent>
          <UFormField label="Site URL" required>
            <UInput placeholder="https://example.com" icon="i-lucide-globe" />
          </UFormField>
          <UFormField label="Ownership method">
            <URadioGroup
              default-value="oauth"
              :items="[
                { label: 'Google OAuth (recommended)', value: 'oauth' },
                { label: 'DNS TXT record', value: 'dns' },
              ]"
            />
          </UFormField>
          <UFormField>
            <UCheckbox label="I have admin access in Search Console" />
          </UFormField>
          <div class="flex items-center gap-2 pt-2">
            <UButton type="submit" icon="i-lucide-check">
              Connect site
            </UButton>
            <UButton variant="ghost" color="neutral">
              Cancel
            </UButton>
          </div>
        </form>
      </UCard>
    </KitSection>
  </div>
</template>
