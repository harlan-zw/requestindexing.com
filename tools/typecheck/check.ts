#!/usr/bin/env node
import type { ParseError } from 'jsonc-parser'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { parse, printParseErrorCode } from 'jsonc-parser'

interface ProjectConfig {
  extends?: string | string[]
  references?: { path: string }[]
  vueCompilerOptions?: Record<string, unknown>
}

async function main() {
  // Keep the native compiler and mapper together. Nuxt's build tools use TypeScript 6.
  const require = createRequire(import.meta.url)
  const args = process.argv.slice(2)
  const projectIndex = args.findIndex(arg => arg === '-p' || arg === '--project')
  const buildIndex = args.findIndex(arg => arg === '-b' || arg === '--build')
  const configArg = projectIndex >= 0 ? args[projectIndex + 1] : buildIndex >= 0 && !args[buildIndex + 1]?.startsWith('-') ? args[buildIndex + 1] : 'tsconfig.json'
  if (!configArg)
    throw new Error('If you use --project, provide a config path.')
  const project = resolve(configArg.endsWith('.json') ? configArg : `${configArg}/tsconfig.json`)
  const cache = resolve(import.meta.dirname, '.generated', createHash('sha256').update(project).digest('hex').slice(0, 16))
  await mkdir(cache, { recursive: true })
  const wrappers = new Map<string, string>()

  function readConfig(file: string): ProjectConfig {
    const errors: ParseError[] = []
    const config = parse(readFileSync(file, 'utf8'), errors, { allowTrailingComma: true })
    if (errors.length)
      throw new Error(`${file}: ${errors.map(error => printParseErrorCode(error.error)).join(', ')}`)
    if (!config || typeof config !== 'object' || Array.isArray(config))
      throw new Error(`${file}: TypeScript config must be an object.`)
    return config as ProjectConfig
  }

  function vueOptions(file: string): Record<string, unknown> {
    const config = readConfig(file)
    const parents: string[] = typeof config.extends === 'string' ? [config.extends] : config.extends ?? []
    const inherited = parents.map(parent => vueOptions(createRequire(file).resolve(parent)))
    return Object.assign({}, ...inherited, config.vueCompilerOptions)
  }

  async function wrap(file: string): Promise<string> {
    const existing = wrappers.get(file)
    if (existing)
      return existing
    const output = resolve(cache, `${wrappers.size}.json`)
    wrappers.set(file, output)
    const config = readConfig(file)
    // This Volar plugin exposes JSON route blocks to the editor, not tsc.
    // Keep all other plugins so unsupported integrations fail explicitly.
    const { plugins = [], ...options } = vueOptions(file)
    if (!Array.isArray(plugins))
      throw new Error('Vue compiler plugins must be an array.')
    options.plugins = plugins.flatMap((plugin) => {
      const entry = typeof plugin === 'string' ? { name: plugin } : plugin
      if (entry?.name === 'vue-router/volar/sfc-route-blocks')
        return []
      if (entry?.name === 'vue-router/volar/sfc-typed-router') {
        return [{
          ...entry,
          name: resolve(import.meta.dirname, 'typed-routes.ts'),
          options: { rootDir: process.cwd(), ...entry.options },
        }]
      }
      return [plugin]
    })
    options.dataAttributes = ['data-*']
    const references = await Promise.all((config.references ?? []).map(async ({ path }: { path: string }) => {
      const target = isAbsolute(path) ? path : resolve(dirname(file), path)
      return { path: await wrap(target.endsWith('.json') ? target : resolve(target, 'tsconfig.json')) }
    }))
    await writeFile(output, `${JSON.stringify({
      extends: file,
      ...(config.references ? { references } : {}),
      contentMappers: [{ package: 'site-typecheck', extensions: ['.vue'], options }],
    }, null, 2)}\n`)
    return output
  }

  const wrapped = await wrap(project)
  if (projectIndex >= 0)
    args.splice(projectIndex, 2)
  if (buildIndex >= 0) {
    const index = args.findIndex(arg => arg === '-b' || arg === '--build')
    if (index >= 0 && args[index + 1] === configArg)
      args.splice(index + 1, 1)
    args.splice(index + 1, 0, wrapped)
  }
  else {
    args.push('--project', wrapped)
  }
  const result = spawnSync(process.execPath, [resolve(dirname(require.resolve('typescript/package.json')), 'bin/tsc'), ...args, '--runExternalCode'], { stdio: 'inherit' })
  if (result.error)
    throw result.error
  if (result.signal)
    throw new Error(`TypeScript stopped with signal ${result.signal}.`)
  process.exitCode = result.status ?? 1
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
