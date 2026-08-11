import type { Locator, Page } from '@playwright/test';
import { createLogger, getLogBuffer, type LogEvent } from '../src/lib/logger';

/**
 * E2E diagnostics, reporting through the app's own centralized logger.
 *
 * Test telemetry goes to the same place app telemetry does — one stream, one
 * format — so a failure can be read as a single ordered story instead of
 * correlated by hand across Playwright output and browser console.
 *
 * These helpers gather EVIDENCE. They never assert and never change what a test
 * does; a probe that alters timing is a probe that hides the bug it was added
 * to find.
 */

export const e2eLog = createLogger('e2e');

/** What Playwright checks before it will click, measured directly. */
export type Actionability = {
  found: boolean;
  visible: boolean;
  enabled: boolean;
  /** Bounding box per animation frame — Playwright needs two identical in a row. */
  rects: { x: number; y: number; w: number; h: number }[];
  /** True when every sampled rect matches the first: the element is "stable". */
  stable: boolean;
  /**
   * What `elementFromPoint` returns at the element's centre. When this is NOT
   * the element (or a descendant), something is covering it and the click can
   * never land — Playwright's hit-target check fails and it retries forever.
   */
  topmostAtCentre: string | null;
  coveredBy: string | null;
  /** Running CSS animations/transitions on the element or an ancestor. */
  animations: string[];
};

/**
 * Sample an element's actionability across several frames.
 *
 * This is the measurement behind "waiting for element to be visible, enabled and
 * stable" — the message Playwright prints while it waits, which on its own does
 * not say WHICH condition is unmet. Here each condition is reported separately.
 */
export async function probeActionability(
  locator: Locator,
  label: string,
  frames = 6
): Promise<Actionability> {
  const handle = await locator.elementHandle({ timeout: 2000 }).catch(() => null);
  if (!handle) {
    const missing: Actionability = {
      found: false,
      visible: false,
      enabled: false,
      rects: [],
      stable: false,
      topmostAtCentre: null,
      coveredBy: null,
      animations: []
    };
    e2eLog.warn('actionability probe: element not found', { label, ...missing });
    return missing;
  }

  const result = await handle.evaluate(async (element: Element, frameCount: number) => {
    const describe = (node: Element | null): string | null => {
      if (!node) return null;
      const tag = node.tagName.toLowerCase();
      const id = node.id ? `#${node.id}` : '';
      const cls = typeof node.className === 'string' && node.className
        ? `.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}`
        : '';
      return `${tag}${id}${cls}`;
    };
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

    const rects: { x: number; y: number; w: number; h: number }[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      const box = element.getBoundingClientRect();
      rects.push({
        x: Math.round(box.x * 100) / 100,
        y: Math.round(box.y * 100) / 100,
        w: Math.round(box.width * 100) / 100,
        h: Math.round(box.height * 100) / 100
      });
      await nextFrame();
    }

    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const visible =
      box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    const enabled = !(element as HTMLButtonElement).disabled;

    // Who actually receives a click at the centre of this element?
    const topmost = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    const covered = topmost && topmost !== element && !element.contains(topmost) ? topmost : null;

    // Running animations on the element or any ancestor — the usual reason a
    // bounding box never settles.
    const animations: string[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      const nodeStyle = getComputedStyle(node);
      if (nodeStyle.animationName && nodeStyle.animationName !== 'none') {
        animations.push(`${describe(node)} animation:${nodeStyle.animationName}`);
      }
      if (nodeStyle.transitionProperty && nodeStyle.transitionProperty !== 'none' && nodeStyle.transitionDuration !== '0s') {
        animations.push(`${describe(node)} transition:${nodeStyle.transitionProperty}/${nodeStyle.transitionDuration}`);
      }
    }

    const first = rects[0];
    const stable = rects.every((r) => r.x === first.x && r.y === first.y && r.w === first.w && r.h === first.h);

    return {
      found: true,
      visible,
      enabled,
      rects,
      stable,
      topmostAtCentre: describe(topmost),
      coveredBy: describe(covered),
      animations: animations.slice(0, 8)
    };
  }, frames);

  await handle.dispose();
  const level = result.stable && !result.coveredBy && result.visible ? 'debug' : 'warn';
  e2eLog[level]('actionability probe', { label, ...result });
  return result;
}

/**
 * Click, and if it does not land quickly, measure why and log it before letting
 * the normal failure happen. The click itself is unchanged — this only adds
 * evidence to a failure that was previously a bare timeout message.
 */
export async function clickWithDiagnostics(
  locator: Locator,
  label: string,
  timeout = 8000
): Promise<void> {
  try {
    await locator.click({ timeout });
    e2eLog.debug('click landed', { label });
  } catch (error) {
    // Where is the page NOW? A locator that resolved and then stopped existing
    // usually means the page navigated out from under the click — which is a
    // very different bug from "the button was covered", and indistinguishable
    // from it in Playwright's own message.
    const page = locator.page();
    const url = page.url();
    e2eLog.error('click did not land — probing why', {
      label,
      urlAtFailure: url,
      error: error instanceof Error ? error.message.split('\n')[0] : String(error)
    });
    await probeActionability(locator, `${label} (after failed click)`);
    const appEvents = await drainPageLog(page, `${label} (after failed click)`);
    for (const event of appEvents.slice(-10)) {
      e2eLog.debug('app event before failure', {
        scope: event.scope,
        level: event.level,
        message: event.message,
        ...(event.data ? { data: event.data } : {})
      });
    }
    throw error;
  }
}

/**
 * Wait until the app stops talking to the API for `quietMs`.
 *
 * A **condition**, not a sleep: it resolves on observed silence, so a slow
 * machine waits longer and a fast one proceeds immediately. Needed whenever a
 * test is about to do something that changes how in-flight requests are
 * answered — revoking a cookie, switching projects — because a request that was
 * already on the wire will come back under the new rules and trigger whatever
 * the app does about it.
 */
export async function waitForApiQuiet(page: Page, quietMs = 600, timeout = 10_000): Promise<void> {
  let lastActivity = Date.now();
  let inFlight = 0;
  const onRequest = (r: { url: () => string }) => {
    if (!r.url().includes('/api/')) return;
    inFlight += 1;
    lastActivity = Date.now();
  };
  const onSettled = (r: { url: () => string }) => {
    if (!r.url().includes('/api/')) return;
    inFlight = Math.max(0, inFlight - 1);
    lastActivity = Date.now();
  };
  page.on('request', onRequest);
  page.on('requestfinished', onSettled);
  page.on('requestfailed', onSettled);
  const deadline = Date.now() + timeout;
  try {
    for (;;) {
      if (inFlight === 0 && Date.now() - lastActivity >= quietMs) return;
      if (Date.now() > deadline) {
        e2eLog.warn('API never went quiet', { inFlight, quietMs, timeout });
        return;
      }
      await page.waitForTimeout(50);
    }
  } finally {
    page.off('request', onRequest);
    page.off('requestfinished', onSettled);
    page.off('requestfailed', onSettled);
  }
}

/** Pull the app's own log buffer out of the page and merge it into this stream. */
export async function drainPageLog(page: Page, label: string): Promise<LogEvent[]> {
  const events = await page
    .evaluate(() => {
      const api = (window as unknown as { __taurusLog?: { getBuffer: () => unknown[] } }).__taurusLog;
      return api ? (api.getBuffer() as unknown[]) : [];
    })
    .catch(() => [] as unknown[]);
  e2eLog.debug('drained page log', { label, count: events.length });
  return events as LogEvent[];
}

/** Everything this run recorded, for printing on failure. */
export function diagnosticsTail(): LogEvent[] {
  return getLogBuffer();
}
