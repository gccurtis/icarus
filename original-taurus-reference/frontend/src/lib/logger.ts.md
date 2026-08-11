# logger.ts — the centralized logger

Companion to [logger.ts](logger.ts). One place every part of Taurus Alpha reports through —
app code and the e2e harness alike — so "what happened, in what order" is answerable from a
single stream instead of reassembled from scattered `console.log` calls.

Built 2026-07-28 while diagnosing an intermittent e2e failure. The immediate need was test
telemetry, but the reason it lives in `src/lib` rather than in `e2e/` is the longer one:
production will want a collector, and centralizing **before** the call sites multiply is much
cheaper than after.

## The shape: events, sinks, scopes

A log event is a plain, serializable record — `at`, `level`, `scope`, `message`, and optional
structured `data`. Serializable **by construction**, so any sink can ship it over a wire
without a translation step.

The module is deliberately **transport-free**. Where events go is a sink's business, and sinks
register at the edges:

- **The buffer sink** is always on: a bounded ring of the last 500 events. Bounded because
  this runs in a long-lived browser tab, where an unbounded log is a leak that only bites in
  the sessions that matter most — the long ones.
- **The console sink** is for humans, routed per level (`warn` goes to `console.warn`, not
  flattened into `log`) so devtools filtering and stack capture keep working.

A production sink is one `addSink` call and needs no change here or at any call site. That is
the whole argument for the indirection.

`createLogger(scope)` binds a subsystem name, and `child(suffix)` nests it —
`createLogger('documents').child('sync')` logs as `documents.sync`. Scopes are what keep a
single stream readable once several subsystems share it.

## Two decisions worth keeping

**A broken sink must never break the code that logged.** `emit` wraps each sink call in a
`try`/`catch` and swallows failures. A telemetry fault becoming a product fault would be a
strictly worse outcome than losing a log line, and it is a real risk the moment a sink does
network I/O.

**`getLogBuffer()` returns a copy.** A reader that could mutate the retained tail could
corrupt the diagnostic it was reading, so it gets a snapshot. Pinned by a test that pushes a
fabricated event into the returned array and asserts the real buffer is unchanged.

Level filtering happens at the source in `emit`, so a suppressed `debug` costs one comparison
rather than allocating an event and handing it to every sink.

## The dev-only window handle

```ts
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  (window as unknown as { __taurusLog?: unknown }).__taurusLog = { getBuffer, clear, setLevel };
}
```

`page.evaluate` runs in the page's own realm and cannot import app modules, so a driving
harness needs a handle hung somewhere reachable to read the app's view of events.

**Dev builds only.** A production bundle must not carry a global that hands out an internal
event stream. The `typeof window` guard keeps SSR and the node-environment unit tests from
touching a global that does not exist there.

`e2e/diagnostics.ts` is the consumer: it drains this buffer into its own stream when a
diagnostic fires, so a failure reads as one ordered story across both sides.

## Adoption

Deliberately **not** retrofitted across the app in the change that introduced it — that would
have been a sweeping edit bolted onto an unrelated fix. Existing `console.error` calls (in
`systems/documents/collaboration.ts`, for instance) are the obvious first migration, and it is
on [the roadmap](../../docs/roadmap/README.md) rather than done opportunistically.

Tested by [logger.test.ts](logger.test.ts): levels and routing, scope nesting, source-level
filtering, sink add/remove, the throwing-sink guarantee, and both ring-buffer properties
(bounded, newest kept; returns a copy).
