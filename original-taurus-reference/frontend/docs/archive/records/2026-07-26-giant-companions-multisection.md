# 2026-07-26 — Convert the 4 giant single-fence companions to multi-section

The last companions still holding their whole source in one fenced block — the four large ones
deferred during the single-fence sweep — are now proper multi-section breakdowns. With these
done, **every source companion in the repo is multi-section and byte-exact**; only the two e2e
`.spec.ts` companions remain single-fence (allowlisted, a separate question about whether test
specs should be companioned at all).

Done with four parallel subagents (one per file, they're 600–1600 lines each), each required to
reach a **plain `OK`** from the verifier (multi-section AND byte-exact, not the allowlisted `OK*`).

## The four, converted

```
src/lib/features/stages/document/runtime.ts              (1581 lines → 46 sections)
src/lib/features/stages/document/panels/DetailsPanel.svelte (878 → 29)
src/lib/features/stages/document/DocumentStage.svelte    (648 → 36)
src/lib/features/stages/document/editor/bridge.ts        (623 → 34)
```

Each split at logical boundaries (imports, then the class/type/function/method/action groups, and
for the `.svelte` files the `<script>` groups → markup → `<style>`), every fenced slice verbatim,
their union reproducing the source byte-for-byte.

## Verifier allowlist tightened

```js
// scripts/verify-companions.mjs — the 4 giants dropped; only the e2e specs remain deferred
const SINGLE_FENCE_ALLOW = [
  'e2e/document-pagination.spec.ts',
  'e2e/resources.spec.ts'
];
```

With the giants now multi-section, they're removed from the deferral allowlist, so the gate
**enforces** multi-section on them from here on (a regression to a single fence would fail).

## Verification

```
node scripts/verify-companions.mjs <every companioned source>
→ OK: 149   OK* (deferred): 2   SINGLE-FENCE: 0   DRIFT: 0   (of 151)
```

Only `*.md` companions changed plus the one-line allowlist edit to `verify-companions.mjs` (and
its companion). `pnpm check` 0/0; `pnpm test` 279. The two `OK*` are the e2e specs; everything
else is a plain `OK`.
