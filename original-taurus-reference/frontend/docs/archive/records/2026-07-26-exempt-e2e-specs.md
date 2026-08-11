# 2026-07-26 — Exempt e2e test specs from companions

The only companions left single-fence were the two Playwright e2e specs
(`e2e/*.spec.ts`). They're tests — for a harness that's currently archived/inactive — so
rather than write multi-section companions for them, they're **exempt** like unit tests.

## What changed

```
AGENTS.md          — Practice 1 excludes now name test files (*.test.ts) AND e2e specs
                     (*.spec.ts): "tests document themselves and are not shipped surface."
                     (The *.test.ts exemption was convention but wasn't written down; now it is.)
deleted            — e2e/document-pagination.spec.ts.md, e2e/resources.spec.ts.md
verify-companions  — SINGLE_FENCE_ALLOW emptied (was the 2 e2e specs); it's now an escape
                     hatch with no entries, since every companioned source is multi-section.
```

## Result

Every companioned source in the repo is now **multi-section and byte-exact** — no deferrals,
no single-fence dumps:

```
node scripts/verify-companions.mjs <every companioned source>
→ OK: 149   OK* (deferred): 0   SINGLE-FENCE: 0   DRIFT: 0
```

`pnpm check` 0/0; `pnpm test` 279. The companion practice is fully clean and gated: any new
drift or large single-fence companion fails `verify-companions.mjs`, and tests/specs are
formally out of scope.
