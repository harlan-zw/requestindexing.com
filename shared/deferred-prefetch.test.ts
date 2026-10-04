import { describe, expect, it } from 'vitest'
import { disableDeferredPrefetch } from './deferred-prefetch'

const source = 'layers/pro-gsc/app/internal/gscdump-realtime-runtime.ts'

describe('deferred resource hints', () => {
  it('stops speculative downloads without removing navigation preloads or imports', () => {
    const manifest = {
      runtime: { src: source, file: 'runtime.hash.js', imports: ['sdk'], prefetch: true, preload: true },
      sdk: { file: 'sdk.hash.js', imports: ['schemas'], prefetch: true, preload: true },
      schemas: { file: 'schemas.hash.js', imports: ['sdk'], prefetch: true, preload: true },
      guides: { file: 'guides.hash.js', prefetch: true, preload: true },
    }

    disableDeferredPrefetch(manifest, source)

    expect(Object.values(manifest).filter(chunk => chunk.prefetch).map(chunk => chunk.file)).toEqual(['guides.hash.js'])
    expect(Object.values(manifest).filter(chunk => chunk.preload).map(chunk => chunk.file)).toEqual([
      'runtime.hash.js',
      'sdk.hash.js',
      'schemas.hash.js',
      'guides.hash.js',
    ])
    expect(manifest.runtime.imports).toEqual(['sdk'])
  })

  it('finds the deferred module by its source when filenames change', () => {
    const manifest = {
      changed: { src: `/checkout/${source}`, prefetch: true },
      unrelated: { src: 'another/runtime.ts', prefetch: true },
    }

    disableDeferredPrefetch(manifest, source)

    expect(Object.entries(manifest).filter(([, chunk]) => chunk.prefetch).map(([key]) => key)).toEqual(['unrelated'])
  })

  it('rejects a missing deferred entry instead of silently restoring speculative downloads', () => {
    expect(() => disableDeferredPrefetch({}, source)).toThrow('Deferred entry is missing')
  })
})
