import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { resolveWorkerSecrets, withWorkerSecretsFile } from '@harlan-zw/nuxt-cloudflare/deploy'
import { CLOUDFLARE_OPTIONAL_SECRETS, CLOUDFLARE_REQUIRED_SECRETS } from '../shared/cloudflare.ts'

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.once('error', rejectPromise)
    child.once('close', (code) => {
      if (code === 0)
        resolvePromise()
      else
        rejectPromise(new Error(`Wrangler exited with code ${code ?? 1}`))
    })
  })
}

async function main(): Promise<void> {
  const resolvedSecrets = resolveWorkerSecrets(CLOUDFLARE_REQUIRED_SECRETS, process.env)
  if (resolvedSecrets._tag === 'missing')
    throw new Error(`Missing Worker secrets: ${resolvedSecrets.names.join(', ')}`)

  const optionalSecrets = Object.fromEntries(CLOUDFLARE_OPTIONAL_SECRETS
    .map(name => [name, process.env[name]] as const)
    .filter((entry): entry is readonly [string, string] => !!entry[1]))

  await withWorkerSecretsFile({
    secrets: { ...resolvedSecrets.secrets, ...optionalSecrets },
    use: secretsPath => runCommand(
      resolve(process.cwd(), 'node_modules/.bin/wrangler'),
      ['--cwd', '.output', 'deploy', '--secrets-file', secretsPath],
    ),
  })
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
