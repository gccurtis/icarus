# Review fixes — flush op-aliasing + PersonasPanel reload; engine-config correction

Two bugs found by an independent code review of this session's diff, both confirmed against the
source and fixed, plus a documentation correction about backend AI-engine configuration.

## Fix 1 (critical) — `flush()` op-array aliasing dropped queued style ops

`DocumentRuntime.flush()` captured `const extras = this.pendingOps` — a **reference**. A style
action firing while a previous flush's `appendChanges` was in flight bare-pushes a
`put_style_definition` onto `this.pendingOps` (via `queueStyleDefinition`); because `extras`
aliased that same array, the post-await cleanup `this.pendingOps.filter(op => !extras.includes(op))`
stripped the brand-new op by reference-equality even though the server never received it. The next
flush then sent the dependent `set_style_default`/`assign_block_style` with no preceding
`put_style_definition` → **409** → silent `reload()` (no toast) → the user's typography change
vanished. Repro: set two heading defaults (or style two blocks) in quick succession under real
network latency.

**Fix:** snapshot a copy — `const extras = [...this.pendingOps]`. One line; also hardens the other
bare-push producer (`addColumn`'s `insert_block`). `runtime.ts` + companion.

## Fix 2 (important) — Personas panel hung on "Loading…" after a project switch

`PersonasPanel.svelte` loaded via `onMount`. The personas store resets to `idle` on a project
switch, but the panel is **not** remounted (the shell swaps rail content by component reference and
`+page.svelte` has no `{#key id}`), so `onMount` never re-fired and the panel showed
"Loading personas…" forever for the new project. **Fix:** replace `onMount` with an `$effect` that
re-runs on the `idle` status change (mirrors `AiTasksPanel`'s `$effect`). `PersonasPanel.svelte` +
companion.

## Doc correction — the backend AI engine

An earlier note claimed "the dev backend has no AI engine configured." That was an artifact of a
**throwaway verify instance** I started with a bare config (`omega-verify.yaml`, no `intelligence`
block → `intelligence: 0 provider(s) configured` → `500` on chat turns). The real `:8443` dev
backend **is** engine-enabled: `taurus-omega/etc/config.local.yaml` (gitignored overlay) configures
an OpenRouter provider (api key set) + reasoning cast tables. So Goal 3.3's generation (chat turns,
Ask, task execution) can be verified end-to-end against `:8443`. Corrected the plan doc.

## Verification

`svelte-check` clean; full vitest suite **224/224**; both touched companions reproduce their source.
