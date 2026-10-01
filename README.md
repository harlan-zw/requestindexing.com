<h1 align='center'>Request Indexing</h1>

<p align="center">
<b>Get your pages indexed.</b><br>
Search Console data and multi-engine submission, in one small app.
</p>

<p align="center">
<table>
<tbody>
<td align="center">
<img alt="" width="800" height="0" /><br>
<i></i> <a href="https://requestindexing.com/">requestindexing.com</a> <br>
<sup>MIT · Cloudflare-native · free during beta</sup><br>
<sub>Built by <a href="https://harlanzw.com">Harlan Wilton</a> · maintainer of <a href="https://nuxtseo.com">Nuxt SEO</a><br> Follow <a href="https://twitter.com/harlan_zw">@harlan_zw</a> · Join <a href="https://discord.gg/275MBUBvgP">Discord</a></sub><br>
<img alt="" width="800" height="0" />
</td>
</tbody>
</table>
</p>

> [!NOTE]
> Free during beta. See [VISION.md](./VISION.md) for what this is and, more importantly, what it is not.

Connect Search Console, see which pages are indexed and which are not, and submit the ones that need it.

## What it does

- 🔍 **Indexing status per URL**: what Google has indexed, what it has not, and the stated reason
- 📤 **Submission**: push new and updated URLs to every engine the protocol supports
- 📈 **Coverage over time**: index percentage, transitions, and what changed since last week
- 🗺️ **Sitemaps**: what you declared, what was discovered, what drifted
- 📊 **The regular Search Console reads**: queries, pages, countries, devices, kept past Google's 16-month window
- 🔓 **MIT + self-host**: same app, your Cloudflare account, your keys

## What it is not

This is a small product on purpose. It does not do AI crawler observability, LLM citation tracking, SPA prerendering, or inject `llms.txt` into your site. Those were an earlier direction and are gone. See [VISION.md](./VISION.md).

## Built on

- [`@gscdump/*`](https://gscdump.com), the engine: sync, retention, indexing inspection, sitemaps, submission, and the public protocol this app consumes
- [Nuxt](https://nuxt.com) + [Nuxt UI Pro](https://ui.nuxt.com/pro?aff=5zj9e) + [Nuxt SEO](https://nuxtseo.com)
- Cloudflare Workers, D1, R2, Queues
- DataForSEO for keyword data

Engine features land here by upgrading the gscdump protocol, not by rebuilding them. IndexNow and Bing Webmaster Tools arrive that way when gscdump ships them.

## Run locally

```bash
git clone git@github.com:harlan-zw/requestindexing.com.git
pnpm i
```

Configure a Google OAuth client at the [Google Developer Console](https://console.developers.google.com/) with scopes `openid`, `email`, `profile`, `webmasters`, and `indexing`, and redirect URLs `http://localhost:3000/auth/google`, `http://localhost:3000/auth/integrations/gsc/callback`, and `http://localhost:3000/auth/google-indexing`.

```bash
# .env
NUXT_OAUTH_GOOGLE_CLIENT_ID=<clientId>
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=<clientSecret>
NUXT_KEY=<must be 32 chars>
NUXT_SESSION_PASSWORD=<secret>
```

Talking to the hosted engine also needs a gscdump partner key (`NUXT_GSCDUMP_API_KEY`) and webhook secret (`NUXT_GSCDUMP_WEBHOOK_SECRET`). See `.dev.vars.example` for the full list.

```bash
pnpm dev
```

Building requires a [Nuxt UI Pro](https://ui.nuxt.com/pro?aff=5zj9e) license:

```bash
NUXT_UI_PRO_LICENSE_KEY=<license> pnpm build
```

## Self-hosting

The hosted product is one deployment of this codebase. Bring your own Cloudflare account, your own Google OAuth app, your own D1 + R2 bindings; deploy with `wrangler deploy`. Full guide: TODO.

## Credits

The original Request Indexing was inspired by [google-indexing-script](https://github.com/goenning/google-indexing-script) ([background](https://seogets.com/blog/google-indexing-script)).

## Sponsors

<p align="center">
  <a href="https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg">
    <img alt="Sponsors" src='https://raw.githubusercontent.com/harlan-zw/static/main/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) © 2022-PRESENT [Harlan Wilton](https://github.com/harlan-zw)
