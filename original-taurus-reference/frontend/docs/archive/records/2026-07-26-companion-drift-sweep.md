# 2026-07-26 — Sweep the 41 pre-existing drifted companions

After the Phase-1 companion redo, a repo-wide run of `scripts/verify-companions.mjs` revealed
that **41 of 140 companioned files already drifted** — none touched by the redo, all
pre-existing. This sweep fixes every one; the repo now verifies **149/149 byte-exact** (149 =
140 previously-companioned + the 9 projects/session backfills).

Done with **six parallel subagents** (grouped by area), each gated on the verifier; then a
consolidated repo-wide verify confirmed zero drift and that only `*.md` files changed.

## What the drift actually was

Three classes, more serious than expected:

- **Dropped inter-section blank lines** (the common case) — a blank line between two
  declarations had been left out of the preceding fence, so the fenced union collapsed a
  `\n\n` to `\n`. Content correct, not byte-exact. Fixed by parking the blank at the end of the
  preceding fence (code slices left untouched). Affected most `documents/*`, several document
  and slides panels, `personas/*`.
- **Stale content** — the source moved on and the companion didn't. The `data/*.ts` re-exports
  (`resources`, `session`, `documents`, `overview`, `document-context`/`-inspector`/`-layout`)
  had been reduced to one-line barrels by the data-layer migration but still documented the
  whole old module; `svelte.config.js` companion was missing the entire `kit.alias` block;
  `flake.nix`, `collaboration.ts`, `UserSettingsDialog`, `WorkSurface`, `FabricCanvas`,
  `HistoryPanel`, `InfoPanel` and others described earlier versions of their source.
- **Structurally broken** — some were the same single-whole-file-fence anti-pattern, and a few
  were worse: `ObjectPositionPanel`'s companion contained a fenced block of code from a
  *different* file (`types.ts`), and `row-repository`'s had a phantom import line absent from
  the source. Both were corrupting the union with code that never existed there.

## Verification

```
node scripts/verify-companions.mjs <every companioned source>
→ OK: 149   DRIFT: 0   NO-COMPANION: 0
```

`git status` confirmed only `*.md` companions changed (41 files) — no source touched. `pnpm
check` 0/0; `pnpm test` 271 (docs-only change). Every companioned file in the repo is now
byte-exact for the first time, and `scripts/verify-companions.mjs` gates it going forward.

## Why sweep now

The single-fence redo surfaced that the byte-for-byte rule had never actually been enforced —
~29% of companions were already off, some describing code that had been moved or deleted. Left
alone, they mislead a reader worse than no companion. Fixing them while the tooling and the
agent pattern were warm was the efficient moment; the committed verifier keeps them honest.
