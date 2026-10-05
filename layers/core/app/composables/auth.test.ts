import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogoutHandler } from './auth'

const clear = vi.fn()
const navigate = vi.fn()
const add = vi.fn()
vi.stubGlobal('useUserSession', () => ({ clear }))
vi.stubGlobal('useToast', () => ({ add }))
vi.stubGlobal('navigateTo', navigate)
vi.stubGlobal('nextTick', (callback: () => void) => callback())

beforeEach(() => {
  clear.mockReset()
  navigate.mockReset()
  add.mockReset()
})

describe('createLogoutHandler', () => {
  it('clears the session before navigating and reporting success', async () => {
    let finish!: () => void
    clear.mockReturnValue(new Promise<void>((resolve) => {
      finish = resolve
    }))
    const pending = createLogoutHandler()()
    expect(navigate).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
    finish()
    await pending
    expect(navigate).toHaveBeenCalledWith('/')
    expect(add).toHaveBeenCalledOnce()
  })

  it('does not navigate or report success when clearing fails', async () => {
    clear.mockRejectedValue(new Error('Session storage unavailable'))
    await expect(createLogoutHandler()()).rejects.toThrow('Session storage unavailable')
    expect(navigate).not.toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
  })

  it('clears an expired session before opening sign in', async () => {
    await createLogoutHandler()(true)
    expect(clear).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('/login')
    expect(add).not.toHaveBeenCalled()
  })
})
