import { describe, expect, it } from 'vitest'
import { bindPageTask, createPageTask, pagePropertyCoversUrl, readPageTask, savedPageMatchesHost } from './page-task'

const now = Date.UTC(2026, 10, 7)

describe('a page carried through setup', () => {
  it('keeps www, path case, and query while removing a fragment', () => {
    expect(createPageTask('https://www.example.com/Case?q=One#section', null, now, 'task-a')).toMatchObject({
      _tag: 'Ok',
      task: { url: 'https://www.example.com/Case?q=One', ownerId: null },
    })
  })

  it.each(['javascript:alert(1)', '//evil.test/path', 'https://user:secret@example.com/', ['https://example.com/'], `https://example.com/${'é'.repeat(500)}`])('rejects unsafe or oversized saved input %s', (url) => {
    expect(createPageTask(url, null, now, 'task-a')._tag).toBe('Err')
  })

  it('binds an anonymous task once and refuses a different person', () => {
    const created = createPageTask('https://example.com/page', null, now, 'task-a')
    if (created._tag !== 'Ok')
      throw new Error('Fixture is invalid')
    const task = bindPageTask(created.task, 7, now)
    expect(task).toMatchObject({ ownerId: 7, url: 'https://example.com/page' })
    expect(readPageTask(task, 8, now)).toEqual({ _tag: 'Missing' })
    expect(bindPageTask(task, 8, now)).toBeNull()
    expect(readPageTask(task, null, now)).toEqual({ _tag: 'Missing' })
  })

  it('expires even if private storage retains the record', () => {
    const created = createPageTask('https://example.com/page', 7, now, 'task-a')
    if (created._tag !== 'Ok')
      throw new Error('Fixture is invalid')
    expect(readPageTask(created.task, 7, created.task.expiresAt)).toEqual({ _tag: 'Expired' })
  })

  it('never substitutes the root domain for the saved www host', () => {
    expect(savedPageMatchesHost('https://www.example.com/page', 'example.com')).toBe(false)
    expect(savedPageMatchesHost('https://www.example.com/page', 'www.example.com')).toBe(true)
  })

  it.each([
    ['https://www.example.com/shop/item', 'sc-domain:example.com', true],
    ['https://www.example.com/shop/item', 'https://www.example.com/shop/', true],
    ['https://www.example.com/shop/item', 'https://example.com/shop/', false],
    ['https://www.example.com/shop/item', 'http://www.example.com/shop/', false],
    ['https://www.example.com/shop/item', 'https://www.example.com/blog/', false],
    ['https://www.example.com/shop/item', 'sc-domain:example.com.evil.test', false],
  ])('checks actual Google prefix coverage for %s and %s', (url, property, covered) => {
    expect(pagePropertyCoversUrl(url, property)).toBe(covered)
  })
})
