import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, Suspense } from 'vue'
import Report from './ProSetupFirstSiteReport.vue'

const io = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('~~/layers/core/app/composables/fetch', () => ({ fetchSites: () => io.read() }))
vi.mock('./ProFirstSiteReport.vue', () => ({
  default: { props: ['siteId'], template: '<div :data-report-site="siteId" />' },
}))

const first = { siteId: 'first', domain: 'first.example', property: 'sc-domain:first.example', syncStatus: 'synced', processing: { indexing: 'discovering' } }
const second = { siteId: 'second', domain: 'second.example', property: 'sc-domain:second.example', syncStatus: 'syncing', processing: { indexing: 'ready' } }
const third = { siteId: 'third', domain: 'third.example', property: 'sc-domain:third.example', syncStatus: 'pending', processing: null }
const mounts: ReturnType<typeof createApp>[] = []

async function mount(sites: object[]) {
  const roster = ref({ sites })
  io.read.mockResolvedValue({ data: roster })
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(Report) }) })
  app.component('UiFavicon', { template: '<span />' })
  app.component('USelect', {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  app.mount(host)
  mounts.push(app)
  await new Promise(resolve => setTimeout(resolve, 0))
  return { host, roster, reportSite: () => host.querySelector('[data-report-site]')?.getAttribute('data-report-site') }
}

afterEach(() => {
  mounts.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

it('opens the only Site report without a Site choice', async () => {
  const page = await mount([first])
  expect(page.reportSite()).toBe('first')
  expect(page.host.textContent).toContain('first.example')
  expect(page.host.querySelector('select')).toBeNull()
})

it('opens several Sites on the one with saved verdicts, and keeps the reader\'s choice', async () => {
  const page = await mount([first, second, third])
  expect(page.reportSite()).toBe('second')
  expect(page.host.querySelector('select')?.value).toBe('second')
  const selector = page.host.querySelector('select')!
  selector.value = 'third'
  selector.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(page.reportSite()).toBe('third')
  expect(page.host.textContent).toContain('Waiting to sync')
})

it('falls back to the default when the chosen Site leaves the list', async () => {
  const page = await mount([first, second, third])
  const selector = page.host.querySelector('select')!
  selector.value = 'third'
  selector.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  page.roster.value = { sites: [first, second] }
  await nextTick()
  expect(page.reportSite()).toBe('second')
})
