import { parse as parseUrl } from 'url'
// @ts-ignore
import { request, cleanup } from './taki'
import chalk from 'chalk'
import { PromiseQueue } from '@egoist/promise-queue'
import { Writer } from './Writer'
import { Logger } from './Logger'
import { Page } from 'puppeteer-core'
import fs from 'fs'
import prependFile from 'prepend-file'

export const SPECIAL_EXTENSIONS_RE = /\.(xml|json)$/
const SITEMAP_PATH = './public/sitemap.xml'

const routeToFile = (route: string) => {
  if (/\.html$/.test(route) || SPECIAL_EXTENSIONS_RE.test(route)) {
    return route
  }
  return route.replace(/\/?$/, '/index.html')
}

const appendPreprendSitemap = async () => {
  await prependFile(SITEMAP_PATH, `<?xml version="1.0" encoding="UTF-8"?>
  <urlset
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd
    http://www.w3.org/1999/xhtml http://www.w3.org/2002/08/xhtml/xhtml1-strict.xsd"
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
  >`)

  fs.appendFileSync(SITEMAP_PATH, '\n</urlset>');
}

export type CrawlerOptions = {
  hostname: string
  port: number
  options: {
    routes: string[] | (() => Promise<string[]>)
    onBrowserPage?: (page: Page) => void | Promise<void>
    manually?: string | boolean
    linkFilter?: (url: string) => boolean
    wait?: string | number
    silent?: boolean
  }
  writer: Writer
  logger: Logger
}

export class Crawler {
  opts: CrawlerOptions

  constructor(opts: CrawlerOptions) {
    this.opts = opts
  }

  async crawl() {
    fs.writeFileSync(SITEMAP_PATH, ''); // wipe sitemap.xml file
    const { hostname, port, options, writer, logger } = this.opts

    const routes =
      typeof options.routes === 'function'
        ? await options.routes()
        : options.routes

    const crawlRoute = async (routes: string[]) => {
      const queue = new PromiseQueue(
        async (route: string) => {
          const file = routeToFile(route)
          let links: Set<string> | undefined
          const html = await request({
            url: `http://${hostname}:${port}${route}`,
            onBeforeRequest(url: any) {
              logger.log(`Crawling contents from ${chalk.cyan(url)}`)
            },
            async onBeforeClosingPage(page: any) {
              links = new Set(
                await page.evaluate(
                  ({ hostname, port }: { hostname: string; port: string }) => {
                    return Array.from(document.querySelectorAll('a'))
                      .filter((a) => {
                        return a.hostname === hostname && a.port === port
                      })
                      .map((a) => a.pathname)
                  },
                  { hostname, port: String(port) }
                )
              )
            },
            manually: SPECIAL_EXTENSIONS_RE.test(route)
              ? true
              : options.manually,
            async onCreatedPage(page: any) {
              if (options.onBrowserPage) {
                await options.onBrowserPage(page)
              }
              page.on('console', (e: any) => {
                const type = e.type()
                // @ts-ignore
                const log = console[type] || console.log
                const location = e.location()

                if(!options.silent) {
                  log(
                    `Message from ${location.url}:${location.lineNumber}:${location.columnNumber}`,
                    e.text()
                    )
                  }
              })
            },
            wait: options.wait,
          })

          if (links && links.size > 0) {
            const filtered = options.linkFilter
              ? Array.from(links).filter(options.linkFilter)
              : links

            for (const link of filtered) {
              queue.add(link)
            }
          }

          logger.log(`Writing ${chalk.cyan(file)} for ${chalk.cyan(route)}`)

          const routeWithTrailingSlash = route.endsWith('/') ? route : route + '/'

          fs.appendFileSync(SITEMAP_PATH, `
  <url>
    <loc>https://core.app${routeWithTrailingSlash}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="de-de" href="https://core.app/de${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="en-us" href="https://core.app/en${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="es-es" href="https://core.app/es${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="hi-in" href="https://core.app/hi${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="ja-jp" href="https://core.app/ja${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="ko-kr" href="https://core.app/ko${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="ru-ru" href="https://core.app/ru${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="tr-tr" href="https://core.app/tr${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="zh-cn" href="https://core.app/zh-cn${routeWithTrailingSlash}" />
    <xhtml:link rel="alternate" hreflang="zh-tw" href="https://core.app/zh-tw${routeWithTrailingSlash}" />
  </url>`);

          await writer.write({ html, file })
        },
        { maxConcurrent: 50 }
      )
      for (const route of routes) {
        queue.add(route)
      }
      await queue.run()
    }

    await crawlRoute(routes)
    await appendPreprendSitemap()
    await cleanup()
  }
}
