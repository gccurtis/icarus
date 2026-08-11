# Change record — 2026-07-21 — Context + inspector panels (the selection lens, prompt blocks)

The panels become real. The left rail is **the map**, the right is **the lens** (per
`docs/reference/application-shell.md`), and the document workflow now runs end to end:
type → Enter → pick a block type in the inspector → make it a Prompt block → save an
instruction → Resolve.

## The seam: the editor session

New `src/lib/editor/session.ts` (+ companion): the **only** contract between the
document stage and the shell panels. The stage publishes `{docId, name, created/updated,
counts, outline, selection, resolving, actions}`; panel content renders from it; `null`
→ intentional defaults. Selection uses the inspector's vocabulary — `none` / `cursor`
(caret in a block) / `block` (gutter-anchor selection) / `range` (text across blocks) —
the distinctions the user experience needed. Actions: `setBlockKind`, `setPrompt`,
`resolvePrompt`, `focusHeading`.

## The rails

- **Context** (left, `ContextPanelContent`): **Properties** (document metadata — real;
  project fallback), **Outline** (live headings, click-to-jump via `focusHeading`),
  **Resources** (mock list, badged; click opens the tab), History/Personas placeholders.
- **Inspector** (right, `InspectorPanelContent`): **Details** — the selection lens:
  document default → block lens with the **kind picker** (an empty paragraph reads
  "New block — choose what this block is", the Enter-then-glance-right flow) → the
  **prompt panel** (status badge/spinner, Instruction + Save, **Resolve**, evidence
  list, "generated text lands in the document") → range counts. **Quarterback** (`ai`)
  — opens automatically when the bar is focused (`QuarterbackDock` → `setPanel`),
  mock-badged until the conversation surface exists.
- `AppShell` gets the new section sets + normalization of stale persisted section ids.

## Editor/data changes backing it

- `documents.ts`: `PromptData`/`PromptEvidence` types; `resolvePromptBlock` (Omega's
  `/dev/` resolve route — promotion requested in
  [backend-requests/prompt-resolve.md](../backend-requests/prompt-resolve.md)) and
  `getJob` polling.
- `bridge.ts`: `nodeKind` exported; the differ now emits `set_block` for **any**
  deliberate kind-attr change (including into/out of `prompt` — safe because typing
  never touches the attr; only the inspector's picker does).
- `DocumentStage`: publishes the session on every transaction; `pendingOps` channel
  (inspector-queued `set_prompt` sent ahead of the diff, effects folded into the
  predicted snapshot); `resolvePrompt` = flush → enqueue job → poll (1s, ~2min cap) →
  reload truth on done / toast on failed.

## Verified

`pnpm check` 0/0; `pnpm build` clean. Live against a throwaway Omega (scratch config +
db; repo untouched): `set_block`→`prompt` + `set_prompt` round-trip (`kind:"prompt"`,
instruction stored), resolve 202 + job polling with the `queued → failed` path
surfacing exactly as the UI handles. **Not exercised:** a real resolve with live
intelligence (spends OpenRouter tokens — user-run; see the plan's review gates).

## Design/plans

Per review request, `docs/plans/` established:
[panel-system design](../plans/2026-07-21-panel-system-design.md) (how per-surface
panel contributions replace today's global section sets — v1's limits stated honestly)
and [next-steps](../plans/2026-07-21-next-steps.md) (the ordered queue).
`architecture/document-editor.md` updated (session seam, invariant 4, extension map).
