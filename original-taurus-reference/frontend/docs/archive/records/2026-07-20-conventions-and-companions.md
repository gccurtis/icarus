# Change record — 2026-07-20 — Conventions, companions, and version audit

Covers the changes pushed in this batch: establishing project conventions
(AGENTS.md / CLAUDE.md), backfilling markdown companion files for all existing
source, and confirming the dependency version posture. Builds on the initial
scaffold committed the previous day.

## Added AGENTS.md as the single source of truth for conventions

```md
# AGENTS.md — taurus-alpha
...
## Practice 1 — Markdown companion files
## Practice 2 — Change records on commit-and-push
```

**Why:** the project needs durable, machine- and human-readable operating
instructions so any agent or contributor works consistently. **Purpose:** it
captures the stack, dev-environment commands, version policy, and the two
standing practices. **Why this way:** AGENTS.md is the emerging cross-tool
standard, so it is the canonical file; keeping one source avoids the two files
drifting apart.

## Added CLAUDE.md as a thin pointer to AGENTS.md

```md
# CLAUDE.md

All conventions, workflows, and project context for this repository live in
**[AGENTS.md](AGENTS.md)**. Read it and follow it.
```

**Why:** Claude Code auto-loads `CLAUDE.md`, and the user asked for one.
**Purpose:** ensure Claude always picks up the conventions. **Why this way:** a
pointer (not a copy) means the rules live in exactly one place — CLAUDE.md never
needs updating when AGENTS.md changes, so the two cannot diverge.

## Established Practice 1 — markdown companion files

```md
Every hand-authored source/config file has a markdown companion named
`<filename>.md` living beside it ... The union of every code block in a
companion must reproduce the entire source file, in order, byte-for-byte.
```

**Why:** the user wants every code file paired with a prose breakdown that
explains it section by section. **Purpose:** a reader can understand any file
without reading the raw source, and intent is captured next to the code. **Why
this way:** the `<filename>.md` naming keeps the companion adjacent and
collision-free (`+page.svelte.md` vs a hypothetical `+page.ts.md`). The hard
"update the companion in the same change as the code" rule is the mitigation for
the practice's real cost — verbatim copies drift if allowed to.

## Backfilled companions for all existing hand-authored files

```text
flake.nix.md          .envrc.md            .gitignore.md
svelte.config.js.md   vite.config.ts.md    tsconfig.json.md
src/app.html.md       src/app.css.md       src/app.d.ts.md
src/routes/+layout.svelte.md               src/routes/+page.svelte.md
```

**Why:** the practice should start from a consistent repo, not a partial one.
**Purpose:** every hand-authored file already in the tree now has its breakdown.
**Why this way:** generated/lock/asset files (`package.json`, `pnpm-lock.yaml`,
`flake.lock`, `favicon.svg`, `.gitkeep`) are excluded because a verbatim
breakdown of generated data is noise that churns constantly.

## Established Practice 2 — change records on commit-and-push

```md
When the user asks to commit and push ... create a change record at
docs/records/YYYY-MM-DD-<short-slug>.md ... For each change: a one-line summary
header, a code block showing the change, and why it was made / its purpose /
why implemented this way.
```

**Why:** the user wants a durable narrative of changes richer than commit
messages, produced at push time. **Purpose:** future readers can reconstruct
*why* the repo looks the way it does. **Why this way:** dated files under
`docs/records/` keep the history append-only and chronologically browsable; this
document is the first instance of the practice.

## Confirmed dependency version posture

```text
Node 24.18.0 (LTS) · Svelte 5.56.6 · SvelteKit 2.70.1 · Vite 8.1.5
Tailwind 4.3.3 · @lucide/svelte 1.25.0 · unplugin-icons 23.0.1
TypeScript 5.9.3 (held — TS 7 breaks svelte-check)
```

**Why:** the user asked to confirm everything is on a modern, supported,
issue-free version. **Purpose:** document that the audit ran and what it found.
**Why this way:** every package is at its current stable release except
TypeScript, deliberately pinned to the 5.x line — TypeScript 7's native compiler
crashes `svelte-check`, so "no known issues" outranks "newest number" until the
Svelte toolchain supports TS 7. `pnpm check` and `pnpm build` both pass on these
versions.
