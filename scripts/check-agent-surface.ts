import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { z } from 'zod'

const { values } = parseArgs({ options: { origin: { type: 'string' } }, strict: true })
const source = await readFile(resolve('apps/marketing/public/skills/google-indexing/SKILL.md'), 'utf8')
const digest = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`
const expected = digest(source)
const artifact = await readFile(resolve('.output/public/skills/google-indexing/SKILL.md'), 'utf8')
if (digest(artifact) !== expected)
  throw new Error('The built skill differs from its source. Rebuild before release.')

if (values.origin) {
  const origin = new URL(values.origin)
  if (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))
    throw new Error('Use an HTTPS origin, or a local preview.')
  const indexUrl = new URL('/.well-known/agent-skills/index.json', origin)
  async function read(url: URL) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' })
    if (!response.ok)
      throw new Error(`Agent surface returned HTTP ${response.status}: ${url.pathname}`)
    return response.text()
  }
  const index = z.object({ skills: z.array(z.object({ name: z.string(), url: z.string(), digest: z.string() })) }).parse(JSON.parse(await read(indexUrl)))
  const entry = index.skills.find(skill => skill.name === 'google-indexing')
  if (!entry || entry.digest !== expected)
    throw new Error('The discovery digest differs from this release. Check the deployed skill.')
  const skillUrl = new URL(entry.url, indexUrl)
  if (skillUrl.origin !== origin.origin)
    throw new Error('The discovery entry leaves the product origin. Correct the skill URL.')
  for (const url of [skillUrl, new URL('/SKILL.md', origin), new URL('/skills/google-indexing/SKILL.md', origin)]) {
    if (digest(await read(url)) !== expected)
      throw new Error(`The served skill differs from this release: ${url.pathname}`)
  }
  const llms = await read(new URL('/llms.txt', origin))
  if (!llms.includes('/.well-known/agent-skills/index.json') || !llms.includes('/SKILL.md'))
    throw new Error('llms.txt does not advertise the skill and discovery index.')
}
process.stdout.write(`Agent skill verified: ${expected}\n`)
