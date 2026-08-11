# Document subsystem — issues, bugs & target-state catalog (2026-07-27)

The specific companion to [`2026-07-27-document-subsystem-reorg.md`](2026-07-27-document-subsystem-reorg.md)
(the plan). This is the **catalog**: every gap, bug, security issue, and dead-code item found in the
read-only mapping + production-readiness pass, each with a location, a severity, and the target
state. Work items are grouped by kind and tagged with the reorg workstream (A DetailsPanel /
B remove-pagination / C runtime-split / D shell-layering) that owns them.

Severity: **P0** = correctness/security, fix deliberately · **P1** = architecture/scale debt that
blocks "lasts & scales" · **P2** = cleanup/consistency.

---

## 1. Bugs (correctness) — P0

| # | Bug | Location | Target |
|---|---|---|---|
| ~~B1~~ | ✅ **FIXED 2026-07-27** (`34be0de`, `e3788a6`). Line spacing did nothing for a text run: `inspectedBlocks` had no `run` branch, so `inspectedRowKeys` was `[]` and `changeSpacing` called `setRowHeight([], …)`. | was `DetailsPanel.svelte:110-123, 258-262` | Done. A run could not name a row at all (`setRowHeight` resolves **by row id** and a run carries only block ids), so the runtime now supplies `rowIds` on `SelectionInfo['run']` — collected in the walk `deriveSelection` already made. `RunLens` passes it; every other lens derives rows from its own blocks. e2e regression test added. |
| ~~B2~~ | ✅ **FIXED 2026-07-27** (`70d5a13`). `findRowsBlock` returned a **live** `Block` that `setBlockAlignment`/`setBlockIndent` mutated in place, which `diffDoc` then spread — an undeclared, unenforced invariant. | was `runtime.ts` | Done — `model/overlay.ts` owns the patches, readers resolve `overlay ?? snapshot`, the snapshot is never written, and `overlay.applyTo(nextRows)` folds them in explicitly at flush. 9 tests, including a differ round-trip that fails without `applyTo`. |
| ~~B3~~ | ✅ **DOCUMENTED 2026-07-27** (`70d5a13`). Direct-op "extras" are sent ahead of the differ's ops; the ordering was load-bearing but implicit. | `runtime.ts` (flush) | Done — behaviour unchanged; the reason (a style definition must precede the op referencing it; block ops must precede content edits that could re-key a block) is now stated at the site that depends on it. |
| ~~B4~~ | ✅ **FIXED 2026-07-27.** **Two kinds of 409 conflated.** Omega answers 409 both for a revision conflict and for its `requireProject` gate (`"select a project first"`, raised *before* the handler runs). `flush` treated every 409 as a conflict: it settled the queued extras (**discarding those ops**) and reloaded the document — **unsaved edits thrown away and the user's selection collapsed** (`restoreSelection` can only restore a caret, not a range), for a condition that only needed the project re-selected. | `model/sync.ts` (`flush`, `reload`) | Done — the append and the reload go through `withProject` like every other project-scoped call; a 409 that survives the select-and-retry is the real conflict and reloads as before. 3 tests in `model/sync.test.ts`; two of them fail without the fix. **Found by investigating an e2e failure that had been dismissed as flakiness.** |
| ~~B5~~ | ✅ **FIXED 2026-07-27.** **`setNameValue` sent an untagged scalar.** Omega decodes the body into a `formula.Value`, which needs `kind`, exactly one payload field, and a **mandatory `shape`** matching the payload; numbers must be strings (exact rational). The client sent bare `42` / `"text"` / `true` → `400 invalid JSON body` every time, so **saving a literal name value could never have worked**. | `systems/projects/api.ts` | Done — `taggedValue()` builds the envelope; all four scalar kinds verified against a live backend. |

## 2. Security — P0 — ✅ ALL FIXED 2026-07-27 (`417ca97`)

**The premise this section was written under turned out to be false.** It assumed
`bridge.ts`'s claim that Omega sanitizes marks server-side, making S1/S2 defense-in-depth.
S4 checked the source: Omega validates colours, but **not** href schemes and **not** font-name
charsets. S1 and S2 were therefore live gaps, and were fixed as such. Record:
[`docs/records/2026-07-27-document-security-hardening.md`](../records/2026-07-27-document-security-hardening.md).

| # | Issue | Location | Outcome |
|---|---|---|---|
| ~~S1~~ | **Link `href` unrestricted** — rendered verbatim; S4 confirmed Omega accepts any non-empty href, so this was a live stored-XSS path. | was `schema.ts` (toDOM + parseDOM); `runtime.ts` (`setLink`) | ✅ `safeHref` allowlists `http`/`https`/`mailto` plus relative/fragment refs and rejects control-character bypasses (`java\tscript:`). Applied at `toDOM`, at `parseDOM` (pasted HTML is untrusted input too) **and** at `setLink` — the write boundary matters because Omega stores whatever it is given, so a bad href would be served to every other reader. A rejected href renders as inert text. |
| ~~S2~~ | **Inline typography injected raw into `style`.** S4 found colours *are* validated server-side; font family/size are only length-bounded (128/32, no charset) — so the font half was live. | was `schema.ts`; `styles.ts` | ✅ `safeCssColor` (mirrors Omega's `validCSSColor` so the two agree), `safeFontFamily`, `safeCssLength` in `systems/documents/sanitize.ts`, applied at the schema marks and `customTypographyCss`. Invalid values are **dropped, not escaped** — the element inherits. 11 tests. |
| ~~S3~~ | **No Content-Security-Policy.** | was absent | ✅ `kit.csp` in `svelte.config.js`: `script-src 'self'`, `object-src 'none'`, `base-uri`/`frame-ancestors`/`form-action 'self'`. **`style-src` must allow `'unsafe-inline'`** — the editor renders decorations as `style` attributes — so CSS injection is covered by S2's validation, not by CSP; that limit is stated in the config rather than implied. The inline theme script moved to `static/theme-init.js` (SvelteKit does not nonce template scripts, and `%sveltekit.nonce%` forbids prerendering). Verified against a running preview server: header present, theme applied, **0 violations**. |
| ~~S4~~ | **Verify server sanitization scope.** | `../taurus-omega`: `changeset_validate.go`, `style.go`, `clone.go` | ✅ **Answered — mostly no.** `href`: non-empty check only. `font.family`/`size`: length only. `fg`/`bg`: genuinely validated. `sanitizeBlockMarks` prunes mark *ranges*, not payloads. Server-side fix requested in [`docs/backend-requests/document-mark-payload-validation.md`](../backend-requests/document-mark-payload-validation.md); Alpha keeps its client-side checks regardless — defence in depth is the right end state, it just should not be the only defence. |

## 3. Performance / scale — P1

| # | Issue | Location | Target |
|---|---|---|---|
| ~~P-1~~ | ✅ **FIXED 2026-07-27** (`908b8bc`). Two full-document walks per transaction (`refreshPagination` + `updateSession`). | was `runtime.ts:302-386, 807-902` | Done — `refreshPresentation` is the one pass; its retained `rowHeightsPx` map feeds both the decorations and the session. |
| P-2 | **Whole-document diff per flush** — `diffDoc(snapshot, doc)` is O(n) every 700 ms of edits. | `bridge.ts:433-623` | Accepted ceiling (see reorg §7). Not changed now; documented, not silent. |
| ~~P-3~~ | ✅ **RESOLVED 2026-07-27** (`908b8bc`). Windowing scaffolding deleted with pagination. | was `pagination/row-repository.ts`, `viewport.ts` | Accepted ceiling for normal docs; virtualization returns as a deliberate future project if ever needed. |

## 4. Architecture / monoliths — P1

| # | Issue | Location | Target |
|---|---|---|---|
| ~~A1~~ | ✅ **DONE 2026-07-27** (`5a16c74`…`0809879`). `runtime.ts` **1623 → 577**. All six `model/*` units from the plan's §4 shipped: `selection`, `overlay`, `presentation`, `sync`, `pm-state`, `actions` (+ `panels`, `search`). | `runtime.ts` | Done — a thin orchestrator. It composes the collaborators, runs the ONE presentation pass, projects the `EditorSession`, and implements four compiler-checked seams: `PmHost` (4), `IndentHost` (2), `SyncHost` (9), `ActionsHost` (9). The order was driven by measurement: the actions' coupling fell 31 → 24 (`SyncEngine`) → 20 (`PmStateHost`) → a 9-member interface once the pure reads moved out. |
| ~~A2~~ | ✅ **DONE 2026-07-27** (`c640dd6`, `e3788a6`). `DetailsPanel.svelte` was 910 lines (7 lenses + 13 controls + 13 state). | `DetailsPanel.svelte` | Done — **42 lines**. `details/lenses/*` (7, each taking its narrowed `SelectionInfo` variant) + `details/controls/*` (13, each owning its own state) + `details/lens-helpers.ts`; canonical-layout notice deduped into `panels/shared/`. Largest new file: `TypographyControls.svelte`, 209 lines. |
| ~~A3~~ | ✅ **DONE 2026-07-27** (workstream D). `QuarterbackPanel.svelte` was 623 lines — sources/attachments/chat-list/transcript/task-card in one file, no sub-components. | `shell/panels/quarterback/` (new) | Done — the panel is an ~80-line view switch; each concern is its own component (`ContextSources`, `ContextAttachments`, `ContextSection`, `ContextManager`, `ChatList`, `Transcript`, `TaskCard`) plus two pure modules (`helpers.ts`, `context-items.ts` — the projection is unit-tested, +5 tests). Mirrors the `DetailsPanel` → `details/` decomposition. |
| ~~A4~~ | ✅ **DONE 2026-07-27** (workstream D). `AppShell.svelte` mixed layout + fallback panel sets + surface-merge rule + persisted-state repair. | `shell/shell-sections.ts` (new) | Done — the section policy (project-context fallback, inspector merge `[details, ...extras, ai]`, `repairSection`) lives in one module; `AppShell` is pure composition and the repair effect only commits what the module decides. |

## 5. Dead / unused code — P1 (delete)

| # | Item | Location | Action |
|---|---|---|---|
| ~~D1~~ | ✅ **DELETED 2026-07-27** (`908b8bc`). The page-pagination stack. | was `pagination/*` | Done — row-height math moved to `systems/documents/layout.ts`; block presentation lives in the slim `editor/presentation-plugin.ts`. |
| ~~D2~~ | ✅ **DELETED 2026-07-27** (`908b8bc`). `DocumentRowRepository` windowing. | was `pagination/row-repository.ts` | Done (the dead `RowManifestEntry` type went with it). |
| ~~D3~~ | ✅ **DELETED 2026-07-27** (`908b8bc`). `ensurePageRange` / `requestedRowWindow`. | was `runtime.ts`; `DocumentStage.svelte`; `session.ts` | Done — the session also dropped `pages`/`pagePlan`/`pageLayout`/`setPageLayout`. |
| ~~D4~~ | ✅ **DELETED 2026-07-27** (workstream D). `data/document-context.ts` — 0 importers; systems counterpart exported nothing. | was `data/document-context.ts`, `systems/documents/context.ts` | Done — both deleted, barrel export removed; the breadcrumb comments live in git history. |
| ~~D5~~ | ✅ **DELETED 2026-07-27** (workstream D). `QuarterbackDock` `currentDoc = activeRuntime()` was never read. | was `QuarterbackDock.svelte:26` | Done — derive and the now-unused registry import deleted. |
| ~~D6~~ | ✅ **DELETED 2026-07-27** (workstream D). `runtime.inspectAnchor` had **no caller** since `3866771` (2026-07-23) removed the left-gutter handles. | was `runtime.ts`; `panels/details/lenses/{Row,Blocks}Lens.svelte` | Done per UX1 — `inspectAnchor`, `RowLens`, `BlocksLens` deleted; dead helpers went with them (`blockKindShortName`, `RowSelection`/`BlocksSelection` slices, `inspector.ts` geometry: `minimumRowHeight`/`normalizedWidths`/`updateNormalizedWidth`); `NoneLens` copy no longer mentions the gutter. Frozen `SelectionInfo` keeps `row`/`blocks`; the dispatcher falls back to `NoneLens`; `actions.inspectBlock` stays (frozen `EditorActions`). |

## 6. Layering / organization — P2

| # | Issue | Location | Target |
|---|---|---|---|
| ~~L1~~ | ✅ **DELETED 2026-07-27** (workstream D). `document-inspector/layout/collaboration.ts` re-exported the *whole* barrel, so a wrong-named import "worked." | was `data/document-*.ts` | Done — all three deleted (plus `data/overview.ts`, the same disease against the projects system). Importers rewired: inspector constants → `$systems/documents/inspector`, collaboration → `$systems/documents/collaboration`, overview → `$data/projects`. |
| ~~L2~~ | ✅ **DELETED 2026-07-27** (workstream D). `data/document-layout.ts` ≡ `data/documents.ts`, 0 importers. | was `data/document-layout.ts` | Done. |
| ~~L3~~ | ✅ **SETTLED 2026-07-27** (workstream D). | AGENTS.md → *Import convention* | One convention, written down: `$data/<system>` is the one facade per system; `$systems/<system>/<submodule>` is the precise import; no other facades. `HistoryPanel`/`AiTasksPanel`-style direct submodule imports are correct under it. |
| ~~L4~~ | ✅ **DONE 2026-07-27** (workstream D). `ResourcesPanel` (generic shell) hardcoded document import/export + `kind==='document'`. | `features/shared/transfer.ts` (new) | Done — the per-kind file-transfer table (`importers` / `exporterFor`) owns which kinds move through files and how; the panel names no kind. Static table rather than a contribution store because import/export is project-level (no live stage to publish from). |
| ~~L5~~ | ✅ **DONE 2026-07-27** (workstream D). `inspector.ts` constants leaked to slides via `$systems/documents/inspector`. | `features/shared/inspector-options.ts` (new) | Done — the three option lists (fonts, reference types, color palette) moved to the neutral `features/shared/` home beside `kinds.ts`/`transfer.ts`; `systems/documents/inspector.ts` deleted (its geometry helpers had already died with the Row lens, D6). |
| ~~L6~~ | ✅ **SIGNPOSTED 2026-07-27** (workstream D). Two typography systems, one barrel, no signpost. | `systems/documents/{styles,types}.ts` | Evaluated: **both are current, different jobs** — semantic tokens back block-TYPE styling (the inspector's "Text type"), `CustomTypography` + inline marks back real fonts (the shipped direction for user-facing font choices); a block renders token CSS → custom → inline. NOT retiring the semantic cascade — it is the Text-type system. Signpost comments added in both files + companions. |

## 6b. Reachability — P1 (product gap, found 2026-07-27)

| # | Issue | Location | Target |
|---|---|---|---|
| ~~UX1~~ | **Two of the seven inspector lenses cannot be opened.** `deriveSelection`'s *live* branch only ever yields `none`/`block`/`new-block`/`new-text`/`run`; `row` and `blocks` come **only** from a pinned `InspectionOverride`, which only `inspectAnchor` sets — and its one caller, the left-gutter handle, was removed on 2026-07-23 (`3866771`). | `model/selection.ts`; `runtime.ts` (`inspectAnchor`); `panels/details/lenses/{Row,Blocks}Lens.svelte` | ✅ **DECIDED 2026-07-27 — stays unreachable, by design.** The Row and Multiple Blocks lenses are intentionally not offered: exposing row/block manipulation affordances makes the product *feel like a block editor* — that feel is part of what sells it. **Clarified by the user (2026-07-27): this is about FEEL, not architecture — the block model IS the data model (Omega blocks/rows stay; runtime/ops/sync all speak blocks); what's decided is that the editing surface must feel like a smooth text editor, with no block-manipulation chrome.** Not a bug; do not re-add an entry point. Consequence for **D** (since done): `inspectAnchor` and the two dead lens files deleted (the frozen `SelectionInfo` contract keeps its `row`/`blocks` modes; the dispatcher has a defensive fallback). |

## 7. Plan-vs-code drift — P2

| # | Issue | Location | Target |
|---|---|---|---|
| ~~PC1~~ | ✅ **DONE 2026-07-27** (workstream D). `runtime-architecture.md` proposed `WorkSurface` registry-dispatch + prop-drilled runtime; shipped code switches on `tab.kind` and each stage self-acquires. | `docs/plans/2026-07-24-runtime-architecture.md` | Done per decision §8.3 — the doc's status header now records the divergence, and the registry-dispatch section carries a "Not shipped — decided against" note explaining why the `tab.kind` switch stays. |

---

## Target state, in one paragraph

A `DocumentRuntime` that is a thin orchestrator over `model/{pm-state, selection, overlay, sync,
presentation, actions}`, each a named unit with a small surface; **no pagination** (one continuous
flow, one presentation pass feeding both decorations and the `EditorSession`, no page sheets/metrics
and no windowing scaffolding); an inspector that is a ~60-line dispatcher over `details/lenses/*` +
`details/controls/*`; a shell whose generic files hold zero document-specific logic; a `data/` layer
with no dead or duplicate facades and one import convention; and a client that adds defense-in-depth
(href allowlist, CSS-value validation, a CSP) on top of the server's mark sanitization. Two contracts
stay frozen throughout: `features/shared/surface.ts` and `editor/session.ts`.
