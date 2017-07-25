#!/usr/bin/env node
const yargs = require('yargs')
const loudRejection = require('loud-rejection')
const chalk = require('chalk')
const pkg = require('../package')

loudRejection()

const argv = yargs
  .option('browser', {
    desc: 'Choose a browser, can be eithor "jsdom" (default) or "chrome"'
  })
  .option('wait', {
    desc: 'Wait for specific ms or dom element to appear'
  })
  .option('manually', {
    desc: 'Manually set ready state in your app'
  })
  .option('routes', {
    desc: 'An array of routes to crawl contents from'
  })
  .option('out-dir', {
    desc: 'The directory to output files'
  })
  .option('quiet', {
    desc: 'Output nothing in console'
  })
  .help()
  .version(pkg.version)
  .alias({
    V: 'vebose',
    v: 'version',
    h: 'help'
  }).argv

// eslint-disable-next-line import/order
const readPkg = require('read-pkg-up')
const Server = require('../lib/Server')
const Crawler = require('../lib/Crawler')
const Writer = require('../lib/Writer')
const Logger = require('../lib/Logger')

const cliOptions = pick(argv, [
  'manually',
  'routes',
  'wait',
  'outDir',
  'verbose',
  'browser'
])
if (argv._[0]) {
  cliOptions.baseDir = argv._[0]
}

let server
let options
let writer
let logger

readPkg()
  .then(({ pkg: userPkg = {} }) => {
    options = Object.assign(
      {
        outDir: '.presite',
        routes: ['/']
      },
      userPkg.presite,
      cliOptions
    )

    if (!options.baseDir) {
      throw new Error('Please provide the path to your SPA!')
    }

    logger = new Logger({ verbose: !options.quiet })

    server = new Server({
      baseDir: options.baseDir
    })

    writer = new Writer({
      outDir: options.outDir
    })

    return Promise.all([server.start(), writer.copyFrom(options.baseDir)])
  })
  .then(() => {
    const crawler = new Crawler({
      hostname: server.hostname,
      port: server.port,
      options,
      writer,
      logger
    })

    return crawler.crawl()
  })
  .then(() => {
    server && server.stop()
    logger.log(`Done, check out ${chalk.yellow(options.outDir)} folder`)
    process.exit()
  })
  .catch(err => {
    console.error(err.stack)
    server && server.stop()
    process.exit(1)
  })

function pick(obj, keys) {
  return keys.reduce((res, next) => {
    if (typeof obj[next] !== 'undefined') {
      res[next] = obj[next]
    }
    return res
  }, {})
}
