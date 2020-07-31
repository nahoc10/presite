#!/usr/bin/env node
import path from 'path'
import { cac } from 'cac'
import chalk from 'chalk'
import update from 'update-notifier'
import JoyCon from 'joycon'

const pkg: typeof import('../package.json') = require('../package')

update({ pkg }).notify()

async function main() {
  const cli = cac('presite')

  cli
    .command('[dir]', `Prerender your website`)
    .option(
      '--wait <time_or_selector>',
      'Wait for specific ms or dom element to appear'
    )
    .option(
      '--manually [optional_variable_name]',
      'Manually set ready state in your app'
    )
    .option('-m, --minify', 'Minify HTML')
    .option('-r, --routes <routes>', 'Addtional routes to crawl contents from')
    .option('-d, -o, --out-dir <dir>', 'The directory to output files')
    .option('-q, --quiet', 'Output nothing in console')
    .action(async (dir: string = '.', flags) => {
      const { Server } = await import('./Server')
      const { Crawler } = await import('./Crawler')
      const { Writer } = await import('./Writer')
      const { Logger } = await import('./Logger')

      type ConfigInput = {
        baseDir?: string
        outDir?: string
        routes?: string[] | (() => Promise<string[]>)
      }

      let config: Required<ConfigInput>

      const joycon = new JoyCon({
        packageKey: 'presite',
        files: ['package.json', 'presite.config.json', 'presite.config.js']
      })

      const { data: configData, path: configPath } = await joycon.load()

      if (configPath) {
        console.log(
          `Using config from ${chalk.green(
            path.relative(process.cwd(), configPath)
          )}`
        )
      }
      config = Object.assign(
        {
          outDir: '.presite',
          routes: ['/']
        },
        configData,
        flags,
        {
          baseDir: dir
        }
      )

      const logger = new Logger({ verbose: !flags.quiet })

      const server = new Server({
        baseDir: config.baseDir
      })

      const writer = new Writer({
        outDir: config.outDir
      })

      await Promise.all([server.start(), writer.copyFrom(config.baseDir)])

      const crawler = new Crawler({
        hostname: server.hostname,
        port: server.port!,
        options: {
          routes: config.routes
        },
        writer,
        logger
      })

      await crawler.crawl()

      server.stop()
      logger.log(`Done, check out ${chalk.green(config.outDir)} folder`)
    })

  cli.version(pkg.version)
  cli.help()

  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
