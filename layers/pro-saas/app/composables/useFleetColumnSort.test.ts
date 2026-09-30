import { describe, expect, it } from 'vitest'
import { useFleetColumnSort } from './useFleetColumnSort'

const values: Record<string, number | null> = { a: 5, b: null, c: 20 }
const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

function order(comparator: ((a: { id: string }, b: { id: string }) => number) | null) {
  return comparator ? rows.toSorted(comparator).map(row => row.id) : null
}

describe('useFleetColumnSort', () => {
  it('cycles a header through descending, ascending, then off', () => {
    const sort = useFleetColumnSort<'clicks'>(id => values[id] ?? null)

    sort.toggleSort('clicks')
    expect(order(sort.sortComparator.value)).toEqual(['c', 'a', 'b'])

    sort.toggleSort('clicks')
    expect(order(sort.sortComparator.value)).toEqual(['a', 'c', 'b'])

    sort.toggleSort('clicks')
    expect(sort.sortComparator.value).toBeNull()
  })

  it('starts a header in its own default direction', () => {
    const sort = useFleetColumnSort<'position'>(id => values[id] ?? null, () => 'asc')
    sort.toggleSort('position')
    expect(order(sort.sortComparator.value)).toEqual(['a', 'c', 'b'])
  })
})
