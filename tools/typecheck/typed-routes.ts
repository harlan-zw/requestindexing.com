import type { VueCodegenPlugin } from '@vue/content-mapper'
import { relative } from 'node:path'

export const codegen: VueCodegenPlugin = ({ ts, fileName, ir, name }, ctx) => {
  const rootDir = ctx.config.options?.rootDir
  if (typeof rootDir !== 'string')
    throw new Error('Typed routes require a rootDir option.')
  const file = JSON.stringify(relative(rootDir, fileName).replaceAll('\\', '/'))
  const Names = name('NativeRouteNames')
  const Route = name('NativeUseRoute')
  const routeArguments = `<${Names}<${file}>>`
  const javascript = (ir.scriptSetup?.lang ?? ir.script?.lang ?? 'ts').startsWith('js')
  const imports = new Set<'names' | 'route'>()
  if (ir.template) {
    imports.add('names')
    imports.add('route')
  }

  return {
    rewrite({ scriptSetup }) {
      ir.scriptSetup?.ast.forEachChild(function visit(node): void {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && !node.typeArguments) {
          if (node.expression.text === 'useRoute' && !node.arguments.length) {
            imports.add('names')
            if (javascript) {
              scriptSetup.insertBefore(node.pos, `/** @type {ReturnType<typeof useRoute${routeArguments}>} */ (`)
              scriptSetup.insertAfter(node.end, ')')
            }
            else {
              scriptSetup.insertAfter(node.expression.end, routeArguments)
            }
          }
          else if (!javascript && node.expression.text === 'definePage' && node.arguments.length === 1) {
            scriptSetup.insertAfter(node.expression.end, `<${file}>`)
          }
        }
        else if (!javascript && ts.isTypeQueryNode(node) && ts.isIdentifier(node.exprName) && node.exprName.text === 'useRoute' && !node.typeArguments) {
          imports.add('names')
          scriptSetup.insertAfter(node.exprName.end, routeArguments)
        }
        node.forEachChild(visit)
      })
    },
    declarations() {
      const declaration = (value: string, source: string) => javascript
        ? `/** @import { ${value} } from '${source}' */\n`
        : `import type { ${value} } from '${source}';\n`
      return [
        ...(imports.has('names') ? [declaration(`_RouteNamesForFilePath as ${Names}`, 'vue-router/auto-routes')] : []),
        ...(imports.has('route') ? [declaration(`useRoute as ${Route}`, 'vue-router')] : []),
      ]
    },
    templateContext: () => ir.template ? [`{ $route: ReturnType<typeof ${Route}${routeArguments}> }`] : [],
  }
}
