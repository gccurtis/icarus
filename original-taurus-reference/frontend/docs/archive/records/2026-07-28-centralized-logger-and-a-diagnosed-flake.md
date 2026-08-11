# 2026-07-28 — A centralized logger, and the "flaky" test that was a real race

Four things, in the order the user asked for them: delete the standing permission to ignore
e2e failures, put the session-expiry budget back, keep the persona budget for its own
reasons, and then actually diagnose the session-expiry failure with real telemetry.

## 1. The permission slip is gone

`AGENT-ORIENTATION.md` told every future agent that some spec failures were "backend drift,
not your regression." That sentence is deleted, replaced by the opposite rule: **every e2e
failure is real until diagnosed** — product bug, stale assertion, or harness defect — and
which one gets established by measurement. The same note now names the two excuses that have
already been wrong here: "backend drift" and "serial-run load".

## 2 & 3. The two budgets, on opposite reasoning

`session-expiry.spec.ts` is **back to the 30s default**. It makes no model calls and finishes
in ~4s; raising it to 90s was treating a hang as slowness, and it failed anyway.

`persona-and-surfaces.spec.ts` **keeps 150s**, and its comment now justifies it by arithmetic
instead of by a failure: its own inner waits budget 60s (15 + 15 + 30) inside a 30s per-test
default, so it was unpassable at 30s regardless of whether the app worked. It also awaits a
real model call, and Omega's provider timeout alone is 60s. The rule the comment states: a
raised budget is only correct when the work genuinely takes that long.

## 4. The centralized logger

`src/lib/logger.ts` — there was none. Structured events (`at`/`level`/`scope`/`message`/
`data`), scoped loggers with `child()` nesting, source-level filtering, and **sinks** as the
only transport concept. Two ship today: an always-on bounded ring buffer (500 events — this
runs in a long-lived tab, where an unbounded log is a leak) and a per-level console sink. A
production collector is one `addSink` call and needs no call-site change, which is the entire
reason to centralize before the call sites multiply rather than after.

Two properties are load-bearing and tested: **a throwing sink cannot break the code that
logged** (telemetry faults must not become product faults), and **`getLogBuffer()` returns a
copy** (a reader must not be able to corrupt the diagnostic it is reading). Nine unit tests,
suite 350 → **359**.

A dev-only `window.__taurusLog` handle exposes the buffer, because `page.evaluate` runs in the
page's realm and cannot import app modules. Guarded by `import.meta.env.DEV` — a production
bundle must not hand out an internal event stream.

`e2e/diagnostics.ts` reports through that same logger, so test and app telemetry form one
ordered story. It adds `probeActionability` (measures each of Playwright's click preconditions
separately — visible, enabled, stable-across-frames, and what `elementFromPoint` returns, since
"waiting for element to be visible, enabled and stable" never says *which*),
`clickWithDiagnostics`, `drainPageLog`, and `waitForApiQuiet`.

## What the telemetry found — first instrumented run

**The failure was never load, and never a hang.** The probe reported the element *missing*
after the failed click, and `urlAtFailure: /login?expired=1&next=/projects/…` — the page had
already navigated away. Omega's log named the culprits: `GET /activity?limit=8` and
`GET /resources?limit=100` returning **401**.

The sequence: the top bar renders as soon as the shell mounts, but the Overview stage is still
loading behind it. The test revoked the session cookie inside that window, those in-flight
requests came back 401, and the expiry watcher **did exactly its job** — hard-navigating to
`/login` and wiping out the top bar the test was about to click.

So the app was right and the test's premise was wrong. Its comment literally claimed "no API
calls here"; there were two.

Fixed with `waitForApiQuiet(page)` — a condition (observed silence, so a slow machine waits
longer and a fast one proceeds immediately), not a sleep — before revoking the cookie.
**Eight consecutive passes**, and the test got ~3x faster (12s → ~4s) because it is no longer
burning time inside a doomed click retry.

## Verification

`pnpm check` 0/0 · vitest **359/359** · build clean · companions OK · e2e **20/20**.
