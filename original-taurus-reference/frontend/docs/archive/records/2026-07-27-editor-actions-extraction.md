# 2026-07-27 — EditorActions moves out; the runtime becomes an orchestrator (workstream C, C7)

The last extraction of the [document-subsystem reorg](../plans/2026-07-27-document-subsystem-reorg.md)
workstream C, and the one everything else was sequenced to make possible.

**`runtime.ts`: 1190 → 577 lines** (1623 at the start of the reorg). Catalog **A1** is closed.

## Why this could be done now and not before

The plan recorded a measurement rather than a target: the actions object's coupling to the runtime
was **31 distinct members** before workstream C, **24** after `SyncEngine`, and **20** after
`PmStateHost` — at which point three of the twenty (`pm`, `sync`, `overlay`) carried 113 of the 152
references. Moving the actions at 31 members would have meant declaring a 31-member interface, which
relocates code without drawing a boundary.

Pulling the remaining pure reads out first took the interface to nine:

```ts
export interface ActionsHost {
  readonly projectId: string;
  readonly resourceId: string;
  readonly title: string;
  setTitle(title: string): void;
  resolving: boolean;
  selection(): SelectionInfo;
  setInspection(override: InspectionOverride | null): void;
  markDirty(): void;
  commitOverlayEdit(): void;
}
```

Nine — the same size as `SyncHost`. `DocumentRuntime implements SyncHost, IndentHost, PmHost,
ActionsHost`; the sizes 9/2/4/9 are the measurement that says the decomposition landed.

## What moved where

- **`model/actions.ts`** (676) — `createEditorActions({ host, pm, sync, overlay })`, the ~25
  commands plus the six shared reads they share (`targetBlock`, `targetRanges`, `blockPosition`,
  `effectiveStyle`, `effectiveCustom`, `queueStyleDefinition`) as closures. A factory rather than a
  class because `EditorActions` is a plain object contract in the frozen `editor/session.ts`.
- **`model/search.ts`** (69) — `findText(doc, query, options)`, previously a private runtime method
  with **no test coverage**.
- **`blockPositionOf(doc, blockId)`** — joined the other pure document reads in `model/selection.ts`.
- `convertBlockAt` became a module-level pure function in `actions.ts`; `sleep` and
  `queueStyleDefinition` left `runtime.ts` entirely.

## The extraction was verified byte-identical

The 532-line action body was moved mechanically, not retyped, and the result was checked by
re-deriving it from the pre-move file and diffing:

```
expected=532 actual=532
IDENTICAL - no action logic changed, only references rebound
```

Worth recording because "I moved 25 actions and they still work" is a claim that deserves better
evidence than a green test run over the four of them the e2e suite touches.

## New tests

`search.test.ts` — 12 tests over `findText` and `blockPositionOf`, on logic that had none. Two pin
behaviour that is easy to lose:

- **an invalid regex returns `[]` rather than throwing.** The Find field re-searches on every
  keystroke, so a user typing `a(b)` sends the invalid `a(` first.
- **a zero-length-capable pattern terminates.** `a*` never advances `lastIndex` on its own; without
  the explicit step the loop spins forever. Note that this test *hangs* rather than fails if the
  guard is removed — which is precisely why it is worth having.

Unit tests: **315 → 327**.

## What is deliberately still in runtime.ts

The `EditorSession` projection (`updateSession`), the presentation pass, the four seam
implementations, and the documents manager. That is the orchestration — composing the collaborators
and publishing what the shell reads — which is what the plan's §4 says a thin `DocumentRuntime`
should be.

## Verification

`pnpm check` 0 errors / 0 warnings · **327 unit tests** · `pnpm build` clean · companions fresh ·
`document-inspector` + `smoke` **6/6 against real Omega**, and `document-inspector` **15/15** on
`--repeat-each=3`.

Full-suite e2e: 10/12. `resources.spec.ts` fails on the pre-`447c1b3` `Block type` label — the
documented, pre-existing drift. The other failure **rotates position between runs** (persona on one
run, the inspector's first test on the next) and does not reproduce in isolation or on repeat, so it
is serial-run load, not a regression; the first spec after an Omega restart is the documented
warm-up case.
