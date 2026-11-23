import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, Suspense } from 'vue'
import Report from './ProSetupFirstSiteReport.vue'

const io = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('~~/layers/core/app/composables/fetch', () => ({ fetchSites: () => io.read() }))
vi.mock('./ProFirstSiteReport.vue', () => ({
  default: { props: ['siteId'], template: '<div :data-preview-site="siteId">Preview URLs</div>' },
}))

const first = { siteId: 'first', domain: 'first.example', property: 'sc-domain:first.example', syncStatus: 'synced' }
const second = { siteId: 'second', domain: 'second.example', property: 'sc-domain:second.example', syncStatus: 'syncing' }
const mounts: ReturnType<typeof createApp>[] = []

async function mount(sites: typeof first[]) {
  const roster = ref({ sites })
  io.read.mockResolvedValue({ data: roster })
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(Report) }) })
  app.component('UFormField', { props: ['label'], template: '<label>{{ label }}<slot /></label>' })
  app.component('USelect', {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="" /><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  app.mount(host)
  mounts.push(app)
  await new Promise(resolve => setTimeout(resolve, 0))
  return { host, roster }
}

afterEach(() => {
  mounts.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

it('opens the only Site report without asking the user to select it', async () => {
  const { host } = await mount([first])
  expect(host.querySelector('[data-preview-site="first"]')?.textContent).toBe('Preview URLs')
  expect(host.textContent).toContain('first.example')
  expect(host.querySelector('select')).toBeNull()
})

it('lets a user with several Sites select the report and clears a lost Site', async () => {
  const { host, roster } = await mount([first, second])
  expect(host.querySelector('[data-preview-site]')).toBeNull()
  const selector = host.querySelector('select')!
  expect([...selector.options].map(option => option.textContent)).toContain('second.example')
  selector.value = 'second'
  selector.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(host.querySelector('[data-preview-site="second"]')?.textContent).toBe('Preview URLs')
  expect(host.textContent).toContain('Syncing')
  roster.value = { sites: [first] }
  await nextTick()
  expect(host.querySelector('[data-preview-site="second"]')).toBeNull()
  expect(host.querySelector('[data-preview-site="first"]')?.textContent).toBe('Preview URLs')
})
