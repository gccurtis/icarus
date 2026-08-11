# Change record — 2026-07-21 — Agent orientation doc

Adds a new `docs/orientation/` directory with a single "read this first" onboarding
document for coding agents (and humans) new to the repo.

## New orientation entry point

```text
docs/orientation/README.md
```

**Why:** onboarding a fresh agent onto this repo took re-deriving the same context every
time — what the project is, the front-end-first architecture, the vocabulary
(Screen/Tab/Stage), what's real vs mock, the non-negotiable practices (companions,
change records, the green gate), and where everything lives. **Purpose:** be the single
artifact you point a coding agent to — "read this, understand it, follow it" — that
fully orients them before they implement a specific task. **Why this way:** it's a
scannable, top-to-bottom guide (project summary → the three hard rules → run/verify →
stack & gotchas → vocabulary → data boundary + a real-vs-mock table → directory map →
design system → a "task → read this" quick reference → a pre-finish checklist). It
defers to `AGENTS.md` as the law and leans on the existing `.md` companions as the way
to understand any individual file, so it stays a map rather than duplicating detail that
would drift. Grounded in a live survey of the tree (routes, `lib/features/*`,
`lib/data/*`, `docs/*`), not memory.
