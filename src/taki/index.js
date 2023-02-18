var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// src/index.ts
__export(exports, {
  cleanup: () => cleanup,
  getBrowser: () => getBrowser,
  request: () => request
});
var import_url = __toModule(require("url"));
var import_debug = __toModule(require("debug"));
var import_puppeteer_core = __toModule(require("puppeteer-core"));
var import_html_minifier = __toModule(require("html-minifier"));

// src/find-chrome.ts
var import_fs = __toModule(require("fs"));
var { CHROME_PATH } = process.env;
var paths_os = process.platform === "darwin" ? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
] : process.platform === "win32" ? [
  process.env.LOCALAPPDATA + "/Google/Chrome/Application/chrome.exe",
  process.env.PROGRAMFILES + "/Google/Chrome/Application/chrome.exe",
  process.env["PROGRAMFILES(X86)"] + "/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA + "/Chromium/Application/chrome.exe",
  process.env.PROGRAMFILES + "/Chromium/Application/chrome.exe",
  process.env["PROGRAMFILES(X86)"] + "/Chromium/Application/chrome.exe"
] : [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium"
];
function getLocalChromiumPath() {
  try {
    const { path } = require("chromium");
    return path;
  } catch {
  }
}
function findChrome() {
  const paths = [
    getLocalChromiumPath(),
    CHROME_PATH,
    ...paths_os
  ];
  for (const p of paths) {
    if (p && import_fs.default.existsSync(p)) {
      return p;
    }
  }
  throw new Error(`Cannot find Chrome on your system`);
}

// src/utils.ts
function truthy(value) {
  return Boolean(value);
}

// src/index.ts
var debugRequest = (0, import_debug.default)("taki:request");
var resourceTypeBlacklist = new Set(["stylesheet", "image", "media", "font"]);
async function getHTML(browser2, options) {
  options.onBeforeRequest && options.onBeforeRequest(options.url);
  const page = await browser2.newPage();
  await page.setRequestInterception(true);
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36 Prerender");
  if (options.onCreatedPage) {
    await options.onCreatedPage(page);
  }
  page.on("request", (interceptedRequest) => {
    const type = interceptedRequest.resourceType();
    const resourceURL = interceptedRequest.url();
    const next = () => {
      debugRequest(`Fetched: ${resourceURL}`);
      interceptedRequest.continue();
    };
    const abort = () => {
      debugRequest(`Aborted: ${resourceURL}`);
      return interceptedRequest.abort();
    };
    if (options.blockCrossOrigin && (0, import_url.parse)(resourceURL).host !== (0, import_url.parse)(options.url).host) {
      return abort();
    }
    if (resourceTypeBlacklist.has(type)) {
      return abort();
    }
    if (options.resourceFilter && !options.resourceFilter({ url: resourceURL, type })) {
      return abort();
    }
    return next();
  });
  let resolveFunction;
  let content = "";
  const promise = new Promise((resolve) => resolveFunction = resolve);
  if (options.manually) {
    const functionName = typeof options.manually === "string" ? options.manually : "snapshot";
    await page.exposeFunction(functionName, (result2) => {
      resolveFunction(result2);
    });
  }
  await page.goto(options.url, {
    waitUntil: options.manually ? "domcontentloaded" : "networkidle2"
  });
  let result;
  if (options.manually) {
    result = await promise;
  } else if (typeof options.wait === "number") {
    await page.waitForTimeout(options.wait);
  } else if (typeof options.wait === "string") {
    await page.waitForSelector(options.wait);
  }
  content = result ? result.content : await page.content();
  options.onBeforeClosingPage && await options.onBeforeClosingPage(page);
  await page.close();
  options.onAfterRequest && options.onAfterRequest(options.url);
  const minifyOptions = typeof options.minify === "object" ? options.minify : {
    minifyCSS: true,
    minifyJS: true,
    collapseWhitespace: true,
    decodeEntities: true,
    removeComments: true,
    removeAttributeQuotes: true,
    removeScriptTypeAttributes: true,
    removeRedundantAttributes: true,
    removeStyleLinkTypeAttributes: true
  };
  return options.minify ? (0, import_html_minifier.minify)(content, minifyOptions) : content;
}
var browser;
async function request(options, { proxy, headless } = {}) {
  if (!browser) {
    browser = await import_puppeteer_core.default.launch({
      executablePath: findChrome(),
      args: ['--disable-web-security', proxy && `--proxy-server=${proxy}`].filter(truthy),
      headless
    });
  }
  try {
    const result = Array.isArray(options) ? await Promise.all(options.map((option) => getHTML(browser, option))) : await getHTML(browser, options);
    return result;
  } catch (error) {
    throw error;
  }
}
async function cleanup() {
  if (browser) {
    await browser.close();
    browser = void 0;
  }
}
function getBrowser() {
  return browser;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cleanup,
  getBrowser,
  request
});
