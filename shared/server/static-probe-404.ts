import { PRERENDERED_PAGE_PATHS } from '../routes'

/**
 * Pure classifier and response helpers for short-circuiting obvious static,
 * CMS, dotfile, and scanner 404 probes before Nuxt SSR boots.
 *
 * Every legitimate dynamic/runtime route prefix is allowlisted FIRST so no
 * application route, dashboard URL-parameter path (e.g. a Search Console page
 * path ending in `.php` or a legacy domain slug like `harlanzw.com`), or
 * framework endpoint can ever be falsely rejected.
 */

export const STATIC_PROBE_404_MAX_AGE_SECONDS = 300
export const ANONYMOUS_404_MAX_AGE_SECONDS = 60

/**
 * Prefixes that belong to Nuxt, Nitro, modules, or runtime app routes.
 * A request under any of these prefixes must NEVER be rejected by the static
 * probe filter — even when a dynamic segment contains dots or file extensions.
 */
const ALLOWED_PREFIXES = [
  // Nuxt / Nitro / module internals
  '/_nuxt',
  '/_ipx',
  '/_og',
  '/_og-static-fonts',
  '/__og-image__',
  '/__comark_content',
  '/__nuxt_error',
  '/__sitemap__',
  '/_favicon',
  '/_ws',
  '/ws',
  '/_alt',
  // Runtime app, API, auth, and legacy redirect trees
  '/api',
  '/auth',
  '/pro',
  '/dashboard',
  '/account',
  '/admin',
  '/kit',
  '/login',
  '/team-invitations',
  // Public content & tool sections
  '/tools',
  '/guides',
  '/comparisons',
  '/skills',
  '/llms',
  '/.well-known/agent-skills',
] as const

const ALLOWED_EXACT_PATHS = new Set<string>([
  '/',
  '/get-started',
  '/privacy',
  '/terms',
  '/robots.txt',
  '/llms.txt',
  '/llms-full.txt',
  '/sitemap.xml',
  '/sitemap_index.xml',
  ...PRERENDERED_PAGE_PATHS,
])

const ALLOWED_SITEMAP_PATTERN = /^\/sitemap(?:[_-][\w-]+)?\.xml$/i

/**
 * CMS, framework debugger, and scanner path segments observed in production
 * 404 traffic. Checked against path segments after collapsing duplicate slashes.
 */
const PROBE_SEGMENTS = new Set([
  'wp-admin',
  'wp-content',
  'wp-includes',
  'wp-json',
  'wp-login',
  'wp-cron',
  'wp-signup',
  'wp-config',
  'wp-trackback',
  'wordpress',
  'xmlrpc',
  'wlwmanifest.xml',
  'cgi-bin',
  'phpmyadmin',
  'pma',
  'myadmin',
  '_ignition',
  '_debugbar',
  '_profiler',
  '_status',
  '_info',
  'actuator',
  'telescope',
  'horizon',
  'elfinder',
  'ckfinder',
  'fckeditor',
  'filemanager',
  'tinyfilemanager',
])

/**
 * Exact root-level extensionless scanner/build/probe filenames observed in
 * production telemetry. Human-plausible typo slugs stay out of this set so
 * real visitors still receive the branded error page.
 */
const PROBE_EXACT_PATHS = new Set([
  '/makefile',
  '/dockerfile',
  '/docker-compose',
  '/brewfile',
  '/gemfile',
  '/procfile',
  '/rakefile',
  '/vagrantfile',
  '/null',
  '/undefined',
  '/metrics',
  '/healthz',
  '/readyz',
  '/server-status',
  '/server-info',
  '/feed',
  '/rss',
  '/atom',
])

/**
 * File extensions that never resolve through Nuxt SSR on this site.
 * Existing static assets (images, fonts, icons, prerendered `.md` files) are
 * served by Cloudflare Workers Static Assets before the Worker runs, and
 * `.md` is intentionally excluded so `nuxt-ai-ready` markdown routes stay open.
 */
const PROBE_EXTENSIONS = new Set([
  // Server-side scripts & executables
  'php',
  'php3',
  'php4',
  'php5',
  'php7',
  'phtml',
  'phar',
  'asp',
  'aspx',
  'ashx',
  'asmx',
  'jsp',
  'jspx',
  'do',
  'action',
  'cgi',
  'pl',
  'py',
  'rb',
  'sh',
  'bash',
  'bat',
  'cmd',
  'exe',
  'dll',
  'so',
  'wasm',
  // Config, secrets, databases, backups & archives
  'env',
  'ini',
  'cfg',
  'conf',
  'config',
  'yml',
  'yaml',
  'toml',
  'sql',
  'sqlite',
  'db',
  'bak',
  'backup',
  'old',
  'orig',
  'save',
  'swp',
  'swo',
  'tmp',
  'temp',
  'log',
  'lock',
  'dist',
  'sample',
  'example',
  'zip',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'xz',
  '7z',
  'rar',
  'jar',
  'war',
  'pem',
  'key',
  'crt',
  'cer',
  'p12',
  'pfx',
  'htpasswd',
  'htaccess',
  // Missing static assets (real assets are served by Workers Assets before the Worker)
  'xml',
  'json',
  'txt',
  'map',
  'js',
  'mjs',
  'cjs',
  'ts',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'shtml',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'ico',
  'webp',
  'avif',
  'bmp',
  'tiff',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'mp3',
  'mp4',
  'webm',
  'ogg',
  'wav',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'rss',
  'atom',
])

function safeDecode(pathname: string): string {
  try {
    return decodeURIComponent(pathname)
  }
  catch {
    // Malformed percent-encoding on a probe URL should not throw.
    return pathname
  }
}

function hasAllowedPrefix(pathname: string): boolean {
  for (const prefix of ALLOWED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`))
      return true
  }
  return false
}

export function isStaticProbe404(rawPath: string): boolean {
  const withoutQuery = rawPath.split('?', 1)[0]!.split('#', 1)[0]!
  const decoded = safeDecode(withoutQuery)
  const collapsed = decoded.replace(/\/{2,}/g, '/')
  const normalized = collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed
  const lower = normalized.toLowerCase()

  if (ALLOWED_EXACT_PATHS.has(lower) || ALLOWED_SITEMAP_PATTERN.test(lower) || hasAllowedPrefix(lower))
    return false

  const segments = lower.split('/').filter(Boolean)
  if (!segments.length)
    return false

  // Dotfiles and hidden directories (`/.env`, `/.git/config`, `/.well-known/*`, `/.vscode/*`, etc.)
  if (segments.some(segment => segment.startsWith('.')))
    return true

  // CMS / WordPress / PHPUnit / framework debugger probes
  if (segments.some(segment => PROBE_SEGMENTS.has(segment)))
    return true
  if (lower.includes('/vendor/phpunit'))
    return true

  // Exact extensionless build/probe filenames (`/Makefile`, `/null`, `//feed/`, `/metrics`, etc.)
  if (PROBE_EXACT_PATHS.has(lower))
    return true

  // Static / script / config / backup file extensions
  const lastSegment = segments[segments.length - 1]!
  const dotIndex = lastSegment.lastIndexOf('.')
  if (dotIndex > 0 && dotIndex < lastSegment.length - 1) {
    const ext = lastSegment.slice(dotIndex + 1)
    if (PROBE_EXTENSIONS.has(ext))
      return true
  }

  return false
}

export function createFast404Response(
  method = 'GET',
  maxAgeSeconds = STATIC_PROBE_404_MAX_AGE_SECONDS,
): Response {
  return new Response(method === 'HEAD' ? null : 'Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'cloudflare-cdn-cache-control': `public, max-age=${maxAgeSeconds}`,
      'x-robots-tag': 'noindex',
    },
  })
}

export function applyAnonymous404CacheHeaders(
  response: Response,
  request: { method: string, headers: Headers },
): void {
  if (response.status !== 404)
    return

  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD')
    return

  if (request.headers.get('cookie') || request.headers.get('authorization'))
    return

  if (response.headers.get('set-cookie'))
    return

  if (!response.headers.has('cloudflare-cdn-cache-control')) {
    response.headers.set('cache-control', 'no-store')
    response.headers.set('cloudflare-cdn-cache-control', `public, max-age=${ANONYMOUS_404_MAX_AGE_SECONDS}`)
  }

  if (!response.headers.get('x-robots-tag')?.toLowerCase().includes('noindex'))
    response.headers.set('x-robots-tag', 'noindex')
}
