import type { FreeToolId } from '#shared/tool-registry'
import { getFreeToolById } from '#shared/tool-registry'

export interface ToolFaqItem {
  question: string
  answer: string
  sources?: { label: string, to: string }[]
}

export interface ToolSeoOptions {
  toolId?: FreeToolId
  title?: string
  description: string
  faqs?: ToolFaqItem[]
  updatedAt?: string
}

export function useToolSeo(opts: ToolSeoOptions) {
  const meta = opts.toolId ? getFreeToolById(opts.toolId) : undefined
  const seoTitle = opts.title || meta?.seoTitle || ''
  const displayTitle = meta?.title || seoTitle
  const updatedAt = opts.updatedAt || meta?.updatedAt
  const modifiedIso = updatedAt ? `${updatedAt}T12:00:00Z` : undefined

  useSeoMeta({
    title: seoTitle,
    description: opts.description,
    ...(modifiedIso ? { articleModifiedTime: modifiedIso } : {}),
  })

  defineOgImage('Tool', {
    title: displayTitle,
    description: opts.description,
  })

  const schemaNodes: Record<string, unknown>[] = [
    defineWebPage({
      name: displayTitle,
      description: opts.description,
      ...(modifiedIso ? { dateModified: modifiedIso } : {}),
    }),
    defineBreadcrumb({
      itemListElement: [
        { name: 'Home', item: '/' },
        { name: 'Tools', item: '/tools' },
        { name: displayTitle },
      ],
    }),
    {
      '@type': 'WebApplication',
      'name': displayTitle,
      'description': opts.description,
      'url': useRequestURL().href,
      'applicationCategory': 'DeveloperApplication',
      'operatingSystem': 'Web',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD',
      },
    },
  ]

  if (opts.faqs?.length) {
    schemaNodes.push({
      '@type': 'FAQPage',
      'mainEntity': opts.faqs.map(faq => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.answer,
        },
      })),
    })
  }

  useSchemaOrg(schemaNodes)
}

export function useLoadingMessages(messages: string[], intervalMs = 1800) {
  const index = ref(0)
  const message = computed(() => messages[index.value % messages.length] || '')
  let timer: ReturnType<typeof setInterval> | null = null

  function start() {
    stop()
    index.value = 0
    if (messages.length <= 1)
      return
    timer = setInterval(() => {
      index.value = (index.value + 1) % messages.length
    }, intervalMs)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onBeforeUnmount(stop)

  return { message, start, stop }
}

interface FathomWindow {
  fathom?: {
    trackEvent: (name: string, opts?: { _value?: number }) => void
  }
}

export function trackToolFathomEvent(name: string): void {
  if (!import.meta.client)
    return
  const fathom = (window as unknown as FathomWindow).fathom
  fathom?.trackEvent(name)
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))
    return `https://${trimmed}`
  return trimmed
}

export function extractDomain(url: string): string {
  const normalized = normalizeUrl(url)
  try {
    return new URL(normalized).hostname
  }
  catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] || url
  }
}

/**
 * Quote a CSV cell safely: double embedded quotes and neutralize spreadsheet
 * formula prefixes (`=`, `+`, `-`, `@`, tab, CR).
 */
export function escapeCsvCell(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${neutralized.replace(/"/g, '""')}"`
}
