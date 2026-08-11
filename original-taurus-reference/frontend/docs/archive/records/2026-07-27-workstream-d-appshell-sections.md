# 2026-07-27 — Workstream D, part 4: AppShell's section policy (A4)

`AppShell.svelte` mixed four concerns: layout, the hardcoded fallback panel sets, the
surface-merge rule, and persisted-state repair. The last three are now
`shell/shell-sections.ts`; the shell is pure composition. No behavior changes — the module's
functions are the same expressions the component held inline.

## The module

- **`contextSectionsFor(surface)`** — the left rail: a surface's context set replaces the
  *entire* project-context fallback (Properties / All resources / History / Personas), so a
  resource editor never inherits irrelevant project-level views.
- **`inspectorSectionsFor(surface)`** — the right rail merge: `[details, ...extras, ai]`. A
  contributed `'details'` section overrides the universal fallback's content; the permanent AI
  Agent tail cannot be removed by a contribution.
- **`repairSection(sections, current)`** — persisted panel state may name a section that isn't
  present (older set, unmounted contribution); returns the rail's first section id to
  normalize to, or `null`. The module *decides*, the shell's effect *commits* the `setPanel`
  write — the same model/orchestrator split as the document runtime.

`AppShell` dropped its six panel imports, six icon imports, and both section-set literals; what
remains is `enterProject`, the two derives calling the module, the repair effect, and markup.

No unit tests for the module: the section sets carry Svelte components and the vitest suite is
node-environment. Its behavior is exercised by every e2e page load (fallback rail on Overview,
replaced rail in a document, repair on stale persisted state) — noted in the companion.

## Companions

`shell-sections.ts.md` new; `AppShell.svelte.md` rewritten as prose (was a ~200-line
byte-mirror of code that has now largely left the file).

## Verification

- `pnpm check` — 0 errors, 0 warnings
- `pnpm test` — 338/338
- `pnpm build` — clean
- companions — verifier OK
- `pnpm test:e2e` — **14/14**
