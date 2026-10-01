interface FAQ {
  question: string
  answer: string
  sources?: { label: string, to: string }[]
}

interface ToolSeoOptions {
  title: string
  description: string
  faqs?: FAQ[]
}

export function useToolSeo(opts: ToolSeoOptions) {
  useSeoMeta({
    title: opts.title,
    description: opts.description,
  })

  defineOgImage('Tool', {
    title: opts.title,
    description: opts.description,
  })

  useSchemaOrg([
    {
      '@type': 'WebApplication',
      'name': opts.title,
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
  ])

  if (opts.faqs?.length) {
    useSchemaOrg([
      {
        '@type': 'FAQPage',
        'mainEntity': opts.faqs.map(faq => ({
          '@type': 'Question',
          'name': faq.question,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': faq.answer,
          },
        })),
      },
    ])
  }
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
