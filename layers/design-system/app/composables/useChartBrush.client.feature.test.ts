import type { UseChartBrush } from './useChartBrush'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { useChartBrush } from './useChartBrush'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  vi.unstubAllGlobals()
})

function chart() {
  const commit = vi.fn()
  let brush!: UseChartBrush
  const frames = new Map<number, FrameRequestCallback>()
  let frameId = 0
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++frameId, fn)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const app = createApp(defineComponent({
    setup() {
      brush = useChartBrush({ dates: ['2026-10-01', '2026-10-02', '2026-10-03'], onCommit: commit })
      return () => h('div', { ref: brush.wrapRef, onPointerdown: brush.onPointerDown })
    },
  }))
  const host = document.createElement('div')
  app.mount(host)
  const el = host.firstElementChild as HTMLElement
  el.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  cleanups.push(() => app.unmount())
  const pointer = (type: string, x: number, y = 0, id = 1) => {
    const event = new Event(type, { bubbles: true })
    Object.assign(event, { button: 0, clientX: x, clientY: y, pointerId: id })
    ;(type === 'pointerdown' ? el : window).dispatchEvent(event)
    for (const [key, fn] of frames) {
      frames.delete(key)
      fn(0)
    }
  }
  return { commit, pointer }
}

it('commits a horizontal drag on release', () => {
  const { commit, pointer } = chart()
  pointer('pointerdown', 0)
  pointer('pointermove', 100)
  pointer('pointerup', 100)
  expect(commit).toHaveBeenCalledWith({ startIdx: 0, endIdx: 2, startDate: '2026-10-01', endDate: '2026-10-03' })
})

it('leaves vertical gestures to page scrolling', () => {
  const { commit, pointer } = chart()
  pointer('pointerdown', 0)
  pointer('pointermove', 30, 50)
  pointer('pointerup', 30, 50)
  expect(commit).not.toHaveBeenCalled()
})

it.each(['pointercancel', 'wheel', 'scroll'])('does not commit after %s', (cancelEvent) => {
  const { commit, pointer } = chart()
  pointer('pointerdown', 0)
  pointer('pointermove', 100)
  if (cancelEvent === 'pointercancel')
    pointer(cancelEvent, 100)
  else
    window.dispatchEvent(new Event(cancelEvent))
  pointer('pointerup', 100)
  expect(commit).not.toHaveBeenCalled()
})

it('ignores another pointer release and keeps the original drag', () => {
  const { commit, pointer } = chart()
  pointer('pointerdown', 0)
  pointer('pointermove', 100)
  pointer('pointerup', 100, 0, 2)
  expect(commit).not.toHaveBeenCalled()
  pointer('pointerup', 100)
  expect(commit).toHaveBeenCalledOnce()
})
