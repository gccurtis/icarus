# 2026-07-27 — Companion docs become prose + a staleness gate (not byte-exact)

Practice 1 changes. Companions were a byte-exact mirror of their source — the union of their
fenced blocks had to reproduce the file verbatim — so every source edit meant re-transcribing
the same change into the companion. That doubled the cost of every change. Going forward,
companions are **documentation**: prose in `##` sections with illustrative snippets, not a
mirror. The gate shifts from "bytes match" to "companion isn't stale".

## verify-companions.mjs is now a staleness check

```js
// A companion must never be older than its source. Any pending working-tree edit ranks
// newest; otherwise the last commit time; mtime is the fallback.
function lastChangeRank(path) {
  if (git(['status', '--porcelain', '--', path]) !== '') return Infinity;
  const committed = git(['log', '-1', '--format=%ct', '--', path]);
  if (committed) return Number(committed);
  try { return statSync(path).mtimeMs / 1000; } catch { return 0; }
}
// STALE when lastChangeRank(source) > lastChangeRank(companion).
```

For each source argument the tool confirms the `<source>.md` companion exists and that the
source has not changed more recently than it. Editing both together (same working-tree change
or same commit) passes; touching only the source flags `STALE`. Git already records each
file's last-change date, so that is the freshness signal — no hand-maintained date, which
would itself drift.

**Why:** the byte-exact rule was the single biggest tax on every change (see the architecture
discussion). A staleness gate keeps the real guarantee that matters — the doc travels with the
code — without forcing a verbatim re-transcription.

## Docs realigned

`AGENTS.md` Practice 1, `CLAUDE.md`, and `docs/orientation/AGENT-ORIENTATION.md` §5 now
describe the prose format and the staleness gate. Existing byte-exact companions still read
fine and don't need to be rewritten; they just stay accurate as their files are touched.

## Also: Selected-Text preview reverts to white

The Selected-Text preview well goes back from the tan `bg-panel` to `bg-work` — the earlier
tan was the wrong one; white for now.
