import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import IndexingChannelsCard from './IndexingChannelsCard.vue'

const apps: ReturnType<typeof createApp>[] = []

function mount(props: { current: 'google' | 'indexnow', siteId: string }) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(IndexingChannelsCard, props)
  app.component('UiCard', defineComponent({
    props: ['title'],
    setup: (cardProps, { slots }) => () => h('div', [cardProps.title, slots.default?.()]),
  }))
  app.component('UiButton', defineComponent({
    props: ['to'],
    setup: (buttonProps, { slots }) => () => h('a', { href: buttonProps.to }, slots.default?.()),
  }))
  app.mount(host)
  apps.push(app)
  return host
}

function links(host: HTMLElement) {
  return [...host.querySelectorAll('a')].map(link => [link.textContent?.trim(), link.getAttribute('href')])
}

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('indexing channels card', () => {
  it('links the Submit to Google page to IndexNow, and never to itself', () => {
    const host = mount({ current: 'google', siteId: 'kv1109' })
    expect(links(host)).toEqual([['Submit with IndexNow', '/pro/dashboard/sites/kv1109/indexing/indexnow']])
  })
})
