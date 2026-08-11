# 2026-07-26 — Sweep non-giant single-fence companions; verifier enforces multi-section

The drift sweep only checked *byte-exactness*, so it missed companions that were byte-correct
but held their whole source in **one fence** — which defeats the point (a companion must
explain code in pieces). A repo-wide scan found **59** single-fence companions; ~25 are
legitimately one section (1-line re-exports, tiny `index.ts` barrels) and stay as-is. Of the
~34 non-trivial ones, this pass converts the **~27 non-giants** to multi-section and defers the
4 giants + 2 e2e specs. The verifier now enforces the rule so it can't recur.

Done with **six parallel subagents** (grouped by area), each gated on the enhanced verifier.

## Verifier now flags large single-fence companions

```js
// scripts/verify-companions.mjs — after the byte-exact check
const lines = want === '' ? 0 : want.split('\n').length;
if (lines > SINGLE_FENCE_MAX /* 40 */ && fenceCount(md) <= 1) {
  if (isDeferred(source)) console.log(`OK*  ${source}  (single-fence — deferred multi-section)`);
  else { drifted = true; console.log(`SINGLE-FENCE  ${source}  (…split into ## sections)`); }
  continue;
}
```

A byte-exact companion whose source exceeds 40 lines but sits in a single fence now **fails**
the check — unless it's on `SINGLE_FENCE_ALLOW`, the documented deferral list (the 4 giants +
2 e2e specs), which prints `OK*` instead. Small files (≤40 lines) may remain one section. The
verifier's own companion was updated to multi-section to satisfy its own new rule.

## The ~27 converted

```
editor:      schema.ts, session.ts, list-commands.ts, pagination-plugin.ts
panels:      LayoutPanel.svelte, OutlinePanel.svelte
pagination:  geometry, page-index, paginate, pagination-policy, viewport
documents:   block-kinds, context, inspector, styles
services:    identity, project-runtime
data:        project-retry, time
shared:      kinds, surface
misc:        theme, identity-directory/mocks, scripts/dev-stack.sh,
             Wordmark.svelte, ProjectPropertiesPanel.svelte, DocumentCollaboratorAvatar.svelte
```

Each is now `## section` / `### one-liner` / verbatim fenced slice / prose, union byte-exact.

## Deferred (tracked in the allowlist + the plan)

The 4 giants — `runtime.ts` (1581 lines), `DetailsPanel.svelte` (878), `DocumentStage.svelte`
(648), `bridge.ts` (623) — and the 2 e2e specs are a focused follow-up. They stay byte-exact;
their multi-section rewrite is deliberately large and separate.

## Verification

```
node scripts/verify-companions.mjs <every companioned source>
→ OK: 143   OK* (deferred): 6   SINGLE-FENCE: 0   DRIFT: 0   (of 149)
```

Only `*.md` companions changed plus the intentional `verify-companions.mjs` enhancement.
`pnpm check` 0/0; `pnpm test` 274 (the verifier is a `scripts/` node tool, outside the svelte
build/test). Every non-deferred companion in the repo is now multi-section and byte-exact, and
the gate keeps it that way.
