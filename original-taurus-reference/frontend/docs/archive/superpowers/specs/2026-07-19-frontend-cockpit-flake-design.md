# Taurus Alpha — Frontend Cockpit: Dev Environment + Scaffold

**Date:** 2026-07-19
**Status:** Approved

## Purpose

`taurus-alpha` is the front-end cockpit / harness / shell for the **Taurus Omega**
back-end engine. This deliverable sets up the front-end development environment
(a Nix flake) and scaffolds a minimal-but-running SvelteKit application to build
on. It is intentionally lean — enough to start, not maximalist. More can be added
when a real need appears.

## Decisions

- **Scope:** Nix flake devShell **and** a scaffolded Svelte 5 app in one step.
- **Package manager:** pnpm.
- **Node:** 24 (current LTS in 2026).
- **Icons:** Lucide primary (`@lucide/svelte`), Iconify via `unplugin-icons` +
  `@iconify/json` as the catch-all backup (~200k icons, on-demand, offline).
- **Fonts:** IBM Plex Sans + IBM Plex Mono, self-hosted via `@fontsource`.

## Part 1 — The flake (workbench)

`flake.nix` exposes one `devShell`. Nix provides only the runtime + Nix-level
tooling; all web libraries live in `package.json` so they version with the app.

- `nodejs_24`
- `pnpm`
- `nil` (Nix LSP) + `nixpkgs-fmt` (Nix formatter) — for editing the flake itself

Inputs: `nixpkgs` (unstable) + `flake-utils` (multi-system Linux/macOS).
Companion files: `.envrc` (`use flake`, for direnv) and `.gitignore`.

## Part 2 — The scaffolded app (cockpit shell)

Minimal SvelteKit + **Svelte 5** + TypeScript + Vite:

- **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-first; theme in `app.css`, no
  large JS config).
- **Fonts:** `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, imported in
  `app.css` and wired into Tailwind font tokens (`--font-sans`, `--font-mono`).
- **Icons:** `@lucide/svelte` primary; `unplugin-icons` + `@iconify/json` backup
  (`import Icon from '~icons/<set>/<name>'`), registered in `vite.config.ts`.
- **Adapter:** `adapter-auto` for now; revisit (static/node) once deployment
  against Taurus Omega is known.

## Part 3 — Proof-of-life page

`src/routes/+page.svelte` renders a placeholder cockpit screen exercising every
piece — IBM Plex Sans/Mono, a Tailwind-styled panel, a Lucide icon, and an
Iconify icon — so `pnpm dev` visibly confirms the full stack. Throwaway smoke
test, not real UI.

## Resulting layout

```
flake.nix  .envrc  .gitignore
package.json  pnpm-lock.yaml  svelte.config.js  vite.config.ts  tsconfig.json
src/app.html  src/app.css  src/routes/+layout.svelte  src/routes/+page.svelte  src/lib/
```

## Scope guardrails (YAGNI)

No component library, no state management, no test framework, no CI, no extra
linting beyond SvelteKit defaults. Add when justified.
