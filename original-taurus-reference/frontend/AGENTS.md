# AGENTS.md — taurus-alpha

Operating instructions for AI agents (and humans) working in this repository.
This file is the single source of truth for conventions; `CLAUDE.md` points here.

**Read [`docs/orientation/AGENT-ORIENTATION.md`](docs/orientation/AGENT-ORIENTATION.md) first.**
This file is the *rules*; that one is the *current state* — what is built, how the document
runtime is shaped, the active plan, the next task, and which test failures are already known.

## What this project is

`taurus-alpha` is the **front-end cockpit** — the user-facing interface, harness,
and shell for the **Taurus Omega** engine (a separate back-end repository). Taurus
Omega is the engine that powers everything; taurus-alpha is the cockpit you fly it
from. Keep that separation in mind: this repo is front-end concerns only.

## Tech stack

| Layer            | Choice                                                      |
| ---------------- | ---------------------------------------------------------- |
| Framework        | SvelteKit + **Svelte 5** (runes)                           |
| Language         | TypeScript                                                 |
| Build            | Vite                                                       |
| Styling          | Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first)           |
| Fonts            | IBM Plex Sans + IBM Plex Mono, self-hosted via `@fontsource` |
| Icons (primary)  | Lucide (`@lucide/svelte`)                                  |
| Icons (backup)   | Iconify via `unplugin-icons` + `@iconify/json`             |
| Dev environment  | Nix flake devShell (Node 24, pnpm)                         |
| Package manager  | pnpm                                                       |

## Terminology

- **Screen** — a full app view: sign-in, project selection, or the project
  workspace shell.
- **Tab** — inside the workspace shell, an open destination or resource (Overview
  or a resource tab; Agents was promoted from a tab to the `/library/agents` route
  2026-07-29, since agents span projects).
- **Stage** — the content a tab renders in the work surface (e.g. the *Overview
  stage*). The **work surface** is the region; the **stage** is what fills it.
  Stages live in `src/lib/features/stages/`.

## Dev environment

The Nix flake provides the runtime and tooling; all web libraries live in
`package.json`.

```bash
direnv allow        # or: nix develop   — enter the devShell
pnpm install        # install web dependencies
pnpm dev            # Vite dev server
pnpm build          # production build
pnpm preview        # preview the production build
pnpm check          # svelte-check (type + Svelte diagnostics)
```

Node and pnpm come from the flake — do not install them globally.

## Version policy

Target versions that are **modern, on a supported line, and free of known
issues** — in that order. "Newest number" loses to "no issues."

- **Node:** current LTS (24.x).
- **TypeScript:** held on the **5.x** line. TypeScript 7's native compiler breaks
  `svelte-check`; do not bump to 7 until the Svelte toolchain supports it.
- Everything else tracks its current stable release.

When bumping versions, run `pnpm check` and `pnpm build` and confirm both pass
before committing.

## Styling

The **authoritative** style spec lives in [`docs/style/`](docs/style/README.md);
its concrete values (hex, type scale, geometry, radii, motion) match the token
system implemented in [`src/app.css`](src/app.css). Use those tokens and the
semantic surface utilities — do not hardcode colors or sizes.

- Change a token in `src/app.css`, then update the matching value in `docs/style/`
  so the spec stays authoritative (and record it on commit-and-push).
- Two themes ship: **Celestial Light** (default, `:root`) and **Eclipse**
  (`data-theme="eclipse"`).
- The design *direction and rationale* (provisional, non-authoritative) is the
  reference corpus under [`docs/support/reference/style/`](docs/support/reference/style/README.md).

## Working with the backend — front-end first

Taurus Alpha is built **front-end first**: design the UX, then back it with Taurus
Omega data. When the backend model differs from what the UI wants, the **UX shape
wins in the interface** — translate at the data boundary (`src/lib/data/*`), not in
components — and record the mismatch in the [architecture doc](docs/architecture/README.md)
for the subsystem that translates, beside the code that does it, so the translation is
intentional and visible. (A dedicated `docs/discrepancies/` directory used to hold these;
it was archived 2026-07-28 because a note nobody reads before touching the code is not
documentation.)

- Talk to Omega through `src/lib/data/*` clients (e.g. [`api.ts`](src/lib/data/api.ts));
  requests go to `/api/*`, proxied to the backend in dev.
- Omega's run & API contract lives in `taurus-omega/docs/backend-guide.md`.
- Keep UI-friendly types/labels; map to/from backend shapes at the edge and link
  the relevant discrepancy doc from the translating code.
- **Terminology vs feature gaps:** a terminology/shape difference is only a
  discrepancy (translate it). A **feature gap** — something the backend must build
  for the UX to work — also gets an actionable, prioritized entry in
  [`docs/backend-requests/`](docs/backend-requests/README.md), the list Omega
  builds against. Mock it in the meantime and badge the mock in the UI.

## Practice 1 — Markdown companion files

**Every hand-authored source/config file has a markdown companion** named
`<filename>.md` living beside it (e.g. `+page.svelte` → `+page.svelte.md`,
`vite.config.ts` → `vite.config.ts.md`). The companion **explains** the file — its
structure, the key pieces, and why they're shaped that way.

**Applies to** files we author: `*.svelte`, `*.ts`, `*.js`, `*.css`, `*.html`,
`flake.nix`, `tsconfig.json`, `.envrc`, `.gitignore`, etc.

**Excludes** generated, lock, and data/asset files: `pnpm-lock.yaml`,
`flake.lock`, `package.json`, `*.svg` and other assets, `.gitkeep`, and anything
in build output. Markdown files (docs, records, companions themselves) are never
companioned; so are **test files (`*.test.ts`) and e2e specs (`*.spec.ts`)** —
tests document themselves and are not shipped surface. **The UI component library
under `src/lib/components/` is also exempt** — these are self-documenting Lego
blocks indexed by their own README;
requiring a companion per component would just double the surface. Application
code that composes them (routes, feature modules) still follows the rule.

### Companion format

Write the companion as prose in `##` sections — one per logical part of the file — each with
a short heading, an **illustrative** fenced snippet (the representative lines, not the whole
file), and a paragraph explaining what it does and why. A companion is documentation, **not a
byte-exact mirror**: quote the parts worth explaining and summarise the rest, so a reader
comes away understanding the file's shape and intent.

### The freshness rule (hard requirement)

When you change a source file, **update its companion in the same change** — a companion must
never be older than the source it documents. Code and companion move together, always. A
commit that edits `foo.ts` but not `foo.ts.md` is incomplete; a new source file means creating
its companion in the same step.

The gate is a **staleness check**: it confirms each companion exists and that its source has
not changed more recently (editing both together passes; touching only the source flags
`STALE`). Git records each file's last-change date, so that is the freshness signal — no
hand-maintained date required.

```
node scripts/verify-companions.mjs <source-file>...
```

**Presentation-only changes are exempt.** If everything that changed since the companion's last
update is a `class` attribute value or a `<style>` block, the check passes and says
`presentation-only`. Re-centring a control, changing a colour, adjusting spacing — none of that
makes the prose wrong, so requiring a companion edit for it produces exactly one behaviour:
people touch the file to silence the gate. (Svelte's `class:name={expr}` directives and `.css`
files are **not** exempt — the first is logic and the second holds the design tokens.)

### Write about behaviour, not decoration

This applies to companions and to code comments alike.

**Document what a reader cannot see by looking**: what the file is for, what contract it holds
up, why a non-obvious choice was made, what breaks if you change it. Load-bearing constraints,
ordering that matters, seams other code depends on, mistakes that have already been made once.

**Do not document decoration.** A comment explaining that `left-1/2 -translate-x-1/2` centres
something is noise — the code says that. Nine lines of rationale above a CSS tweak is worse than
none, because it buries the two comments on the page that actually matter. The same goes for
prose in a companion narrating class strings.

The test before writing either: *would a competent reader be surprised, or get this wrong,
without the note?* If not, leave it out. Deleting a comment that no longer earns its place is a
normal, welcome edit.

## Practice 2 — Change records on commit-and-push

When the user asks to **commit and push** (or before pushing any substantive
change), create a change record at:

```
docs/archive/records/YYYY-MM-DD-<short-slug>.md
```

It documents every meaningful change in the push. For each change:

- `##` — a **one-line summary** of the change (the section header).
- A fenced **code block** showing the change (the added/changed code, or a diff).
- A paragraph explaining **why it was made, what purpose it serves, and why it
  was implemented this way**.

The record is a durable narrative of *why the repo looks the way it does* —
richer than a commit message, aimed at a future reader reconstructing intent.

## Repository layout

```
flake.nix / .envrc / .gitignore    Nix devShell + env + ignores (each with .md companion)
package.json / pnpm-lock.yaml       Web dependencies (no companions)
svelte.config.js / vite.config.ts   SvelteKit + Vite config (with .md companions)
tsconfig.json                       TypeScript config (with .md companion)
src/app.html / app.css / app.d.ts   App shell, styles, ambient types (with companions)
src/routes/                         SvelteKit routes (with companions)
src/lib/                            Shared components/utilities
static/                             Static assets (favicon, etc.)
docs/                               Documentation — see docs/README.md for the map
docs/archive/records/               Change records (Practice 2)
```

**The documentation rule: everything outside `docs/archive/` is current.** Dated,
superseded, or completed material lives in the archive; a doc in a live directory that
describes something which no longer exists is a bug, not history. Start at
[`docs/README.md`](docs/README.md), which names what each directory answers. The two
"what's next" lists are deliberately separate: [`docs/roadmap/`](docs/roadmap/README.md) is
**our** work, [`docs/backend-requests/`](docs/backend-requests/README.md) is **Omega's**.

### Import convention for the `$data` / `$systems` aliases

Settled in workstream D (catalog L1–L3):

- **`$data/<system>` is the one facade per system** — `$data/documents`, `$data/projects`,
  `$data/session`, … — a one-line re-export of `$systems/<system>/index`. Use it when you want
  the system's public surface (types + client, e.g. `Block`, `appendChanges`).
- **`$systems/<system>/<submodule>` is the precise import** — use it when you want one specific
  module (`$systems/documents/sanitize`, `$systems/documents/collaboration`,
  `$systems/documents/inspector`). Reaching a submodule directly is correct, not a smell.
- **No other facades.** Never add a second `$data` name for the same system (the deleted
  `document-inspector`/`document-layout`/`document-collaboration`/`overview` were exactly that:
  four extra names that re-exported the whole barrel and narrowed nothing, so a wrong-named
  import still "worked").
- `$data` also holds the genuinely app-level modules that are not system facades
  (`api`, `workspace`, `transfer`, `time`, `project-retry`).
