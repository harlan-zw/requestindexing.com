import type { ContentMapper } from '@vue/content-mapper'
import { existsSync } from 'node:fs'
import { createContentMapper, runMapperServer, toOptionDiagnostics } from '@vue/content-mapper'

const vue = createContentMapper({ name: 'Vue content mapper', toOptionDiagnostics })

// Native resolution maps packaged runtime SFCs before checking their declarations.
// Forward through a .js specifier so normal declaration resolution applies.
const mapper: ContentMapper = {
  ...vue,
  transform(params) {
    if (params.fileName.split(/[\\/]/).includes('node_modules')) {
      const candidates = [params.fileName.replace(/\.vue$/, '.d.vue.ts'), `${params.fileName}.d.ts`]
      const declaration = candidates.find(existsSync)
      if (declaration) {
        const specifier = JSON.stringify(declaration.replace(/\.ts$/, '.js'))
        return {
          text: `export * from ${specifier};\nexport { default } from ${specifier};\n`,
          extension: '.ts',
          mappings: [],
        }
      }
    }
    return vue.transform(params)
  },
}

runMapperServer(mapper)
