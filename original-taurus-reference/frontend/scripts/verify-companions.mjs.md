# scripts/verify-companions.mjs — breakdown

Companion to [verify-companions.mjs](verify-companions.mjs). The **staleness check** for
Practice 1 (see AGENTS.md): every hand-authored source/config file has a `<file>.md`
companion, and a companion must never be older than the source it documents. This is a
prose companion, illustrative rather than byte-exact — matching the practice it enforces.

## What it checks

Companions are explanations in prose with illustrative snippets, **not** byte-exact mirrors
of the source. So the tool no longer extracts and diffs code blocks. Instead it enforces the
one hard rule per source argument:

- the `<source>.md` companion **exists** (missing → `NO COMPANION`, exit 1), and
- the source has **not changed more recently** than its companion (source newer → `STALE`,
  exit 1) — unless everything that changed is presentation, see below; otherwise `OK`.

Editing the source and its companion together — in the same working-tree change, or committed
in the same commit — passes. Touching only the source (forgetting the companion) is what
`STALE` catches.

## The presentation-only exemption

A source that outranks its companion is not automatically stale. Before failing, the tool asks
whether anything **behavioural** changed:

```js
function withoutPresentation(text) { /* blank <style> blocks and class attribute values */ }
```

It fetches the source as it stood at the companion's last commit (`git show <commit>:<path>`),
blanks the presentation out of both that and the current file, and compares. Equal means the only
difference is decoration, and the result is `OK … (presentation-only change since …)`.

Presentation means two things: the **value** of a `class` attribute (including prop variants like
`triggerClass`, matched quoted or brace-delimited with real brace-matching so `cn(...)` calls are
handled), and `<style>` blocks. Restyling — re-centring a control, changing a colour, adjusting
spacing — touches only these, and demanding a companion edit for it teaches people to touch the
file to silence the gate, which is worse than not checking at all.

Two deliberate non-exemptions: Svelte's `class:name={expr}` directives, because the expression is
logic (the pattern matches `class=`, not `class:`), and `.css` files, because `app.css` carries the
design tokens. The exemption also cannot fire when the companion has no commit to compare against
— then the original staleness rule stands.

## How "last change" is ranked

```js
function lastChangeRank(path) {
  if (git(['status', '--porcelain', '--', path]) !== '') return Infinity;   // pending edit = newest
  const committed = git(['log', '-1', '--format=%ct', '--', path]);
  if (committed) return Number(committed);                                    // last commit time
  try { return statSync(path).mtimeMs / 1000; } catch { return 0; }          // mtime fallback
}
```

Each path gets a sortable rank. Any working-tree change (staged, unstaged, or untracked)
ranks as `Infinity` so an uncommitted source edit outranks a clean companion; a clean file
uses its last commit's unix time (`%ct`); filesystem mtime is the fallback when git can't
answer (`git` shells out through a small `execFileSync` helper that returns `''` on failure).
The source is stale-flagged only when `lastChangeRank(source) > lastChangeRank(companion)`.

## Usage and exit

```
node scripts/verify-companions.mjs <source-file>...
```

It takes explicit source paths (typically the files a change touched), prints one line each
(`OK` / `NO COMPANION` / `STALE`), and exits non-zero if any source is missing a companion or
is newer than its companion — so it can gate a commit. No arguments prints usage and exits 2.
