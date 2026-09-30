import { expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import UiSparkColumns from './UiSparkColumns.vue'

function columnHeights(html: string): number[] {
  return [...html.matchAll(/<rect[^>]*\sheight="([\d.]+)"/g)].map(match => Number(match[1]))
}

it('keeps early activity when an uneven series folds into columns', async () => {
  // 19 days into the 18-column `sm` preset: two days per column, one day left
  // over at the start. The only activity sits on that leftover first day.
  const data = [9, ...Array.from<number>({ length: 18 }).fill(0)]
  const html = await renderToString(createSSRApp({ render: () => h(UiSparkColumns, { data, size: 'sm' }) }))
  const heights = columnHeights(html)
  expect(heights).toHaveLength(10)
  expect(heights[0]).toBe(20)
  expect(heights.slice(1).every(height => height === 2)).toBe(true)
})
