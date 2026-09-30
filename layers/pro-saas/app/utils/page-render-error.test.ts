import { describe, expect, it } from 'vitest'
import { isPageRenderError } from './page-render-error'

// Vue labels the source of a captured error in `info`: a readable name in a
// development build, a link that ends in the error code in production.
const PROD = 'https://vuejs.org/error-reference/#runtime-'

describe('isPageRenderError', () => {
  it.each([
    'native event handler',
    'component event handler',
    'watcher callback',
    `${PROD}3`,
    `${PROD}5`,
    `${PROD}6`,
  ])('leaves the page on screen for a failure after render: %s', (info) => {
    expect(isPageRenderError(info)).toBe(false)
  })

  it.each([
    'setup function',
    'render function',
    'mounted hook',
    'component update',
    `${PROD}0`,
    `${PROD}1`,
    `${PROD}m`,
    `${PROD}15`,
  ])('replaces the page when it cannot render: %s', (info) => {
    expect(isPageRenderError(info)).toBe(true)
  })
})
