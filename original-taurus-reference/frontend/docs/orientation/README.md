# Orientation — start here

> **→ Read [`AGENT-ORIENTATION.md`](AGENT-ORIENTATION.md) first** (updated 2026-07-27) for the
> current build state, the runtime system, how to make companion docs correctly, the
> build/test/verify workflow (real models, Omega restarts, e2e), and the open tasks. This
> README stays the evergreen reference for vocabulary, the directory map, the design system,
> and gotchas — but its "real vs mock" snapshot (§6) is out of date; trust AGENT-ORIENTATION.md
> for what is built now.

**You are a coding agent about to work in `taurus-alpha`. Read this document top to
bottom before touching anything.** It orients you to the repo — what it is, how it's
built, where things live, the vocabulary, and the non-negotiable practices — so that by
the end you can go implement a specific task correctly and in-style.

Its companion in authority is [`AGENTS.md`](../../AGENTS.md) at the repo root: this doc
orients you; **AGENTS.md is the law**. Read this, then skim AGENTS.md, then read the
`.md` companion next to whatever file you're about to change.

---

## 1. What this project is

`taurus-alpha` is the **front-end cockpit** — the user-facing interface, shell, and
harness — for **Taurus Omega**, a separate Go back-end engine (lives at
`../taurus-omega`, HTTPS on `127.0.0.1:8443` in dev). Omega is the engine; alpha is the
cockpit you fly it from.

> This repo is **front-end concerns only.** Don't add backend logic here; talk to Omega
> across the data boundary (§6).

It's a **SvelteKit + Svelte 5** app: a sign-in screen, a project-selection screen, and a
per-project **workspace shell** (top bar, tabs, side panels, a floating AI bar, a work
surface that renders "stages").

## 2. The three things you must not break

These are hard requirements. A change that violates any of them is incomplete.

1. **Markdown companions.** Every hand-authored source/config file has a `<filename>.md`
   twin beside it that reproduces the file verbatim in fenced blocks with prose. **When
   you change a source file, update its companion in the same change.** New source file →
   new companion. *(Exempt: `src/lib/components/*` and markdown files themselves.)* See
   AGENTS.md → Practice 1. **This is also your fastest way to understand the codebase —
   read a file's `.md` instead of the code.**
2. **Change records.** On commit-and-push (or before any substantive push), add
   `docs/archive/records/YYYY-MM-DD-<slug>.md` narrating each change and *why*. See AGENTS.md →
   Practice 2.
3. **The green gate.** `pnpm check` must report **0 errors / 0 warnings**, and
   `pnpm build` must succeed, before you consider a change done.

## 3. Run & verify

Node and pnpm come from the **Nix flake**, not your global env — run tooling through it:

```bash
nix develop --command pnpm check     # svelte-check: MUST be 0 errors / 0 warnings
nix develop --command pnpm build     # production build: MUST pass
nix develop --command pnpm test:e2e  # Playwright against the real Alpha + Omega stack
nix develop --command pnpm dev:all   # run BOTH alpha (Vite, HTTPS) + Omega together
nix develop --command pnpm dev:start # start both in the background and health-check them
nix develop --command pnpm dev:status
nix develop --command pnpm dev:logs
nix develop --command pnpm dev:stop  # stop the managed background stack
```

`dev:all` (see `scripts/dev.sh`) starts the Omega Go backend and the Vite dev server
together; Vite proxies `/api/*` → `https://127.0.0.1:8443` so the session cookie is
same-origin. `dev:start` wraps that runner with explicit `stop`, `restart`, `status`,
and `logs` commands, storing local state under ignored `.taurus-dev/`. `pnpm dev`
runs the front-end alone.

## 4. Tech stack (and its gotchas)

| Layer | Choice |
| --- | --- |
| Framework | SvelteKit + **Svelte 5** — runes (`$state`, `$derived`, `$props`, `$effect`, `$bindable`), snippets (`{#snippet}`/`{@render}`) |
| Styling | **Tailwind CSS v4** (CSS-first, `@theme` in `src/app.css`) |
| Language | TypeScript, **pinned to the 5.x line** (TS 7 breaks `svelte-check` — do not bump) |
| Icons | Lucide (`@lucide/svelte`); Iconify as backup |
| Fonts | IBM Plex Sans + Mono, self-hosted |
| Env | Nix flake devShell (Node 24, pnpm) |

**Gotchas that will bite you:**

- **Dynamic Tailwind classes don't compile.** `bg-${tone}` / `text-${x}` produce nothing.
  Use **literal-string maps** (e.g. `iconTileClass()` in `data/projects.ts`). Arbitrary
  values like `grid-cols-[minmax(0,1fr)_5rem]` *do* work — but only because the literal
  string appears in the source; never build them by interpolation.
- **Overlays use fixed-coordinate positioning.** `Menu`/`Popover` compute the trigger's
  rect and render `position: fixed`, so dropdowns escape any `overflow` / scrolling
  ancestor. Follow that pattern for new overlays inside scroll containers.
- **`nix develop` can't see untracked files** in a flake repo — `git add` new files
  before running it, or checks won't include them.

## 5. Vocabulary (learn this before reading code)

- **Screen** — a full view: sign-in, project selection, or the project workspace shell.
- **Tab** — inside the shell, an open destination or resource. One permanent tab:
  **Overview**. The **`+`** opens a **New tab** (a blank *launcher*); opening a
  resource makes a resource tab. (Agents was a permanent tab until 2026-07-29,
  when it was promoted to the `/library/agents` route — agents span projects.)
- **Stage** — the content a tab renders in the **work surface** (the region). Stages live
  in `src/lib/features/stages/`. Today: `OverviewStage`, `NewTabStage`, and the real
  `DocumentStage`; unsupported resource families use an honest placeholder. A blank tab
  has `kind: 'new'` → renders the launcher; picking something **resolves it in place**
  into a resource tab (browser-style).
- **Resource** — a project's content. Kinds: `document`, `spreadsheet` (labeled
  "Sheet"), `slides`, `chat` (a distinct *AI chat space*, not a thread), and `general`
  (catch-all / uploads). *(`board` was removed.)*
- **AI Agent** — the floating Ask/Action/Plan composer at the bottom of the shell,
  paired with the inspector's chats, optional context, and plans. The current
  resource is implicit. Distinct from "AI create" (make a *new* resource).
- **Strict project isolation** is an architecture law: Omega resources/content are
  selected-project scoped; client-only workspace state is namespaced by project id in
  `localStorage`. Neither may bleed across projects.

## 6. Architecture — front-end first, and the data boundary

The project is built **front-end first**: design the UX, *then* back it with Omega. When
the backend model differs from what the UI wants, **the UX shape wins in the interface**
and you translate at the edge — **`src/lib/data/*`**, never in components.

- All Omega calls go through `src/lib/data/*` clients (`api.ts` wraps `fetch` to `/api`).
- **Terminology/shape difference** → just translate it, and record the translation in the
  [architecture doc](../architecture/README.md) for the subsystem doing it. Example: UI
  says `owner/editor/viewer`; Omega says `owner/edit/read` — translated in
  `systems/projects/api.ts`.
- **Feature gap** (backend must build something) → an actionable ask in
  [`docs/backend-requests/`](../backend-requests/README.md). Use an honest unavailable
  state or a clearly badged mock until it lands.

### What's real vs mock (as of now)

| Real (backed by Omega / persisted) | Mock / unavailable (explicitly marked) |
| --- | --- |
| Auth/session and persisted display name (`/auth/*`) | Notification preferences |
| Projects: lifecycle, rename/icon/visibility, purpose, members/roles, share links | Projects-list member summary (self-only fallback; backend gap) |
| Resource catalog: list/create/rename/delete/open for documents | Spreadsheet/slides/chat/general creation and editors (unavailable) |
| Document editing: `/documents`, change sets, marks, prompt resolve | AI resource generation and starter-template content |
| Document in-place rename + real edit timestamps | Document last-editor attribution and live presence (badged mock) |
| Overview purpose + Activity feed | File import, content export, resource visibility/options |
| Theme and per-project workspace shell state (`localStorage`) | AI Agent conversation/action/plan execution; Agents/History/Personas content |

If you touch anything mock or unavailable, read its discrepancy + backend-request doc
first, keep the state explicit, and don't let placeholder shapes leak backend
assumptions.

## 7. Directory map

```text
AGENTS.md                     The conventions (the law). CLAUDE.md points here.
scripts/dev.sh                Runs Omega + Vite together in the foreground (pnpm dev:all).
scripts/dev-stack.sh          Manages the combined stack in the background.
src/
  app.html                    HTML shell + a pre-paint theme boot script.
  app.css                     THE design token system (both themes) — see §8.
  app.d.ts                    Ambient types.
  routes/                     SvelteKit routes (each with a .md companion):
    +layout.svelte              Root layout: loads app.css, activates theme, hydrates session.
    +page.svelte                Entry gate at `/`: redirects to /projects or /login by session.
    login/+page.svelte          The sign-in screen.
    join/[token]/+page.svelte   Redeems a role-carrying project share link.
    projects/                   Project selection (+page) and its guard (+layout.ts).
    projects/[id]/+page.svelte  The workspace — mounts the shell for one project.
    components/+page.svelte      A live gallery of the component library.
  lib/
    components/               46 UI primitives (Button, Modal, Menu, Popover, …).
                              Barrel-exported via index.ts. EXEMPT from companions.
    features/                 Composed application surfaces (companioned). OWNERSHIP IS
                              THE TREE: stages never import each other; the shell never
                              imports stages (WorkSurface, the stage router, is the one
                              sanctioned exception); everyone may use shared/ + data/.
      shell/                    The workspace shell, fully separated: AppShell, bars,
                                TabStrip, SidePanel, WorkSurface (stage router),
                                QuarterbackDock (the AI Agent composer), StatusBar, UserSettingsDialog, and
                                panels/ — the UNIVERSAL rail sections (project
                                properties, resources, history, personas, AI Agent).
      shared/                   Cross-feature contracts: kinds.ts (per-kind icon/tone/
                                label) and surface.ts (the panel-contribution store).
      stages/
        overview/                 OverviewStage + its pieces (purpose, create column,
                                  activity feed/actor).
        new-tab/                  NewTabStage + NewResourcePanel, TemplatesCarousel,
                                  AiCreateDialog.
        document/                 The document editor, whole: DocumentStage, panels/
                                  (Info/Search/Outline + mock-backed context views +
                                  Details lens), editor/ (schema, bridge, session —
                                  the ProseMirror ↔ Omega machinery).
        shared/                   Only what stages genuinely share: ResourceTable + its
                                  dialogs (Import, Export, ResourceSettings).
      projects/                 CreateProjectDialog, ProjectSettingsDialog, MemberAvatar.
    data/                     THE data boundary (companioned), deliberately flat — one
                              file per Omega capability: api, session, projects,
                              overview, resources, documents, document-collaboration,
                              workspace, transfer.
                              Omega calls and client-side persistence boundaries live here.
    theme.ts motion.ts        Theme store, motion tokens,
    toast.ts  utils.ts        toast store, small helpers.
docs/
  orientation/                You are here.
  architecture/               Conceptual → implementation maps for substantial subsystems
                              (start here for the document editor).
  plans/                      Active plans only — usually empty (they graduate to archive/).
  roadmap/                    What WE build next, plus what we decided not to build.
  style/                      AUTHORITATIVE style spec (hex, type scale, motion) — mirrors app.css.
  backend-requests/           The prioritized "Omega, build this" list (open asks only).
  support/                    Background material, incl. the non-authoritative design corpus.
  archive/                    Everything dated or superseded: records/, plans/, and the rest.
```

Everything outside `archive/` is current — see [`docs/README.md`](../README.md) for the map.

## 8. The design system (use it — don't hardcode)

- **`src/app.css`** defines every token: colors (semantic *roles* — `action`, `intel`,
  `focus`, `attention`, `success`, `danger`, `neutral`), type scale (`text-h1`…`text-caption`),
  geometry, radii (`rounded-control`/`panel`/`overlay`), and motion (`--motion-*`,
  `--ease-taurus`, exposed as `dur-*` utilities). **Use these tokens and the surface
  utilities (`surface-panel`, `bg-work`, `bg-canvas`, …) — never hardcode colors/sizes.**
- Two themes: **Celestial Light** (default, `:root`) and **Eclipse** (`[data-theme='eclipse']`).
  Toggled by clicking the centered **"taurus"** wordmark; `theme.ts` mirrors it to
  `<html data-theme>` + `localStorage`; a boot script in `app.html` applies it pre-paint.
- The authoritative spec is [`docs/style/`](../style/README.md); if you change a token in
  `app.css`, update the matching value there.

## 9. Quick reference — "I need to… → read this"

| Task | Read first |
| --- | --- |
| Understand any single file | Its `.md` companion (verbatim breakdown) |
| Style something | [`docs/style/`](../style/README.md) + the tokens in `src/app.css` |
| Add/compose UI | `src/lib/components/` (+ its README) and the `/components` gallery route |
| Touch Omega data, local persistence, or a mock | The `src/lib/data/*` companion + `docs/discrepancies/` + `docs/backend-requests/` |
| Work on the workspace chrome | `src/lib/features/shell/` companions (AppShell orchestrates) |
| Work on tab content / a stage | `src/lib/features/stages/` companions |
| Add a resource kind or its icon/color | `src/lib/features/shared/kinds.ts` + `data/resources.ts` |
| Work on the document editor / sync | [`docs/architecture/document-editor.md`](../architecture/document-editor.md) first, then the `features/stages/document/` + `data/documents.ts` companions |
| See why the repo looks the way it does | `docs/archive/records/` |

## 10. Before you finish

- [ ] Companion `.md` updated (or created) in the **same change** as every source file.
- [ ] Mocks are badged in the UI and documented (discrepancy + backend-request if a gap).
- [ ] `nix develop --command pnpm check` → **0 errors / 0 warnings**.
- [ ] `nix develop --command pnpm build` → passes.
- [ ] On commit-and-push: a `docs/archive/records/YYYY-MM-DD-<slug>.md` narrating the change.

That's the orientation. Now read AGENTS.md, then the companion(s) for your target area,
then go do the specific task you were given.
