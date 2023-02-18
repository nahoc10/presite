import pptr, { Page } from 'puppeteer-core';
export { Browser, Page } from 'puppeteer-core';

declare type ResourceFilterCtx = {
    url: string;
    type: string;
};

declare type RequestOptions = {
    url: string;
    manually?: string | boolean;
    wait?: string | number;
    onBeforeRequest?: (url: string) => void;
    onAfterRequest?: (url: string) => void;
    onCreatedPage?: (page: Page) => void | Promise<void>;
    onBeforeClosingPage?: (page: Page) => void | Promise<void>;
    minify?: boolean;
    resourceFilter?: (ctx: ResourceFilterCtx) => boolean;
    blockCrossOrigin?: boolean;
};
declare type BrowserOptions = {
    proxy?: string;
    headless?: boolean;
};
declare function request(options: RequestOptions, browserOptions?: BrowserOptions): Promise<string>;
declare function request(options: RequestOptions[], browserOptions?: BrowserOptions): Promise<string[]>;
declare function cleanup(): Promise<void>;
declare function getBrowser(): pptr.Browser | undefined;

export { BrowserOptions, RequestOptions, ResourceFilterCtx, cleanup, getBrowser, request };
