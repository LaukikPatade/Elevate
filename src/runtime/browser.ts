import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const ESBUILD_NAME_HELPER_SHIM =
  "globalThis.__name = globalThis.__name || function (f) { return f; };";

export class BrowserSession {
  private browser?: Browser;
  private context?: BrowserContext;
  page!: Page;

  constructor(private readonly headless = true) {}

  async start(): Promise<void> {
    this.browser = await chromium.launch({ headless: this.headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Elevate-Agent/0.1 (+https://elevate.dev/bot)",
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(8000);
    // tsx compiles evaluate() callbacks with an esbuild __name helper that does not exist in page scope.
    await this.page.addInitScript(ESBUILD_NAME_HELPER_SHIM);
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
  }
}
