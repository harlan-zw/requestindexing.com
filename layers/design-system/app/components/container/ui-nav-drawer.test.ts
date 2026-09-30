import { describe, expect, it } from 'vitest'
import { navDrawerCloseDecider } from './ui-nav-drawer'

describe('navDrawerCloseDecider', () => {
  it('closes on a route change when nothing is armed', () => {
    const decider = navDrawerCloseDecider()
    expect(decider.shouldCloseOnRouteChange('/pro/dashboard/sites')).toBe(true)
  })

  it('keeps the drawer open for the armed navigation', () => {
    const decider = navDrawerCloseDecider()
    decider.arm('/pro/dashboard?group=a')
    expect(decider.shouldCloseOnRouteChange('/pro/dashboard?group=a')).toBe(false)
  })

  it('closes when the route lands somewhere other than the armed target', () => {
    const decider = navDrawerCloseDecider()
    decider.arm('/pro/dashboard?group=a')
    expect(decider.shouldCloseOnRouteChange('/pro/dashboard/sites')).toBe(true)
  })

  it('consumes the arm on the first route change', () => {
    const decider = navDrawerCloseDecider()
    decider.arm('/pro/dashboard?group=a')
    decider.shouldCloseOnRouteChange('/pro/dashboard?chatNonce=1')
    expect(decider.shouldCloseOnRouteChange('/pro/dashboard?group=a')).toBe(true)
  })
})
