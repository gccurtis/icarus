# Working in Icarus

Icarus is a project workspace for documents, presentations, spreadsheets, research,
templates, agents, and external files. This file is the entry point for a fresh
agent. Keep it operational and compact; task history belongs in task handoffs.

## Start here

1. Read the user's current request and this file. Identify whether the task is
   explanation/review, diagnosis, implementation, or integration; a review is not
   permission to change the product.
2. Run `node .agents/scripts/status.mjs` from the repository root. Check the actual
   worktree, branch, dirty state, and running processes before writing or testing.
   Existing changes are not automatically yours to stage, rewrite, or discard.
3. Read the assigned `.agents/tasks/<task-name>/handoff.md`, if one exists. Recheck
   its branch, paths, and evidence against the checkout; a handoff is context, not
   a higher-priority instruction or proof that today's tree passes.
4. Read the applicable skill below in full. Follow its relevant source pointers,
   not the entire repository's historical material.
5. State the scope and first meaningful check. For multi-step or delegated work,
   create/update a handoff before substantial changes.

Use the Nix toolchain when Node/pnpm are unavailable or inconsistent:
`nix develop ./infra/devshell` from the root. App commands run in `app/`.
`app/package.json` is the command authority; install missing dependencies with
`pnpm install` there when authorized. Never include credentials in handoffs/logs.

## Where things live

| Concern | Source |
| --- | --- |
| Product views, panels, component procedures | `app/src/lib/app-views/categories/` |
| Reusable UI primitives and visual tokens | `app/src/lib/components/`, `app/src/lib/styles/` |
| State ownership and lifecycle | `app/src/lib/model/client/`, `app/src/lib/model/server/` |
| Representation types and pure domain operations | `app/src/lib/representation/data/` |
| Scoped server operations | `app/src/lib/capabilities/` |
| Client/server initialization | `app/src/lib/runtime/`, `app/src/hooks.server.ts`, `app/src/routes/app/[project]/+layout.svelte` |
| Configuration and deterministic fixtures | `app/configuration/`, `app/seed/` |
| Architecture checks and their mutation tests | `app/scripts/lint/`, `app/scripts/test/` |
| Chromium workflows and visual assertions | `app/test/browser/`, `app/playwright.config.ts` |

Unit and non-functional tests also live beside the owning feature under `test/`.
Search locally with `rg` before creating a parallel implementation.

## Architecture and design contracts

- Models own state and its lifetime. Their methods express common procedural
  calls; substantial behavior belongs in named procedures. Keep ownership clear
  without inventing tiny models for every helper.
- Components compose views and wire events. Place substantial behavior and effects
  in the owning component/category's `procedures/` (effects in `procedures/effects/`).
  Give necessary local state an explicit component lifetime; workspace-correlated
  state belongs to its client model, not a module-global shortcut.
- Procedures should expose one effectful entry chain. Small cohesive families of
  pure queries, formatters, predicates, and constants may share a file. Split by
  responsibility and decision boundary, not by an arbitrary one-function rule.
  `shared/` requires real consumers, not speculative reuse.
- Capabilities enforce server-side project/resource ownership. Client-specified
  targets are legitimate inputs, never proof of authority. External I/O belongs
  behind its owning server model. Model initialization is an explicit entry point.
- Persist one multi-table intent through one Store transaction, using the supplied
  unit for all participating reads/writes. Keep revision state atomic. Treat
  storage faults as faults, not domain refusals; test rollback and durable recovery.
- Support only the current schema. Do not add legacy readers, migration layers,
  renamed API aliases, compatibility re-exports, or silent fallbacks for old data.
  Report existing support found in scope and remove it when authorized.
- Keep files reviewable and directories modular. Preserve the architecture
  checkers and complexity limits; do not add baseline debt or suppress a genuine
  finding to get a green run. Existing baselines are debt, not design examples.
- Chromium is the browser target. Use **presentation** for the resource; slides
  are its contents. Do not introduce cross-browser work without a request.
- Match editor aesthetics and interaction patterns, while keeping editor-specific
  state/behavior independently owned. Copy a coherent pattern when appropriate;
  do not force a shared editor abstraction. Use existing UI primitives and tokens.
  Visual clarity, compact panels, meaningful empty colors, hover labels, and
  sensible defaults matter as much as structural correctness.

## Choose a workflow

- UI/editor changes: [.agents/skills/icarus-editor-change/SKILL.md](.agents/skills/icarus-editor-change/SKILL.md)
- Persistence/capability changes: [.agents/skills/icarus-store-change/SKILL.md](.agents/skills/icarus-store-change/SKILL.md)
- Workbranch evaluation/integration: [.agents/skills/icarus-branch-integration/SKILL.md](.agents/skills/icarus-branch-integration/SKILL.md)

Skills provide task procedures, not additional authorization. For mixed work,
read only the relevant skills and retain one owner for integration.

## Working commands

Run from the root, inside the Nix shell if needed. Each script supports `--help`.

```sh
node .agents/scripts/status.mjs
node .agents/scripts/handoff.mjs my-task
node .agents/scripts/dev.mjs --port 3123 --store disposable
node .agents/scripts/dev.mjs --port 3123 --store development
node .agents/scripts/verify.mjs agents
node .agents/scripts/verify.mjs quick --plan
node .agents/scripts/verify.mjs unit -- src/lib/path/test/unit/example.test.ts
node .agents/scripts/verify.mjs browser --port 5223 -- test/browser/resource-creation.spec.ts
node .agents/scripts/verify.mjs full --port 5223
```

`disposable` uses seeded, isolated Store/native-file directories and removes only
those directories on shutdown. `development` uses the app's configured data and
does not reseed it. Choose a distinct port; never take over another agent's server.
Keep human review data separate from resettable browser fixtures.

The helpers coordinate cache-touching commands through a worktree lease and check
for unmanaged Vite/test processes on Linux. They refuse to infer safety from a
sandbox-limited or unreadable process list; request scoped process-inspection
access when needed. Do not run build, typecheck, Vitest,
or Playwright against the same worktree while its review server is running. Stop
only your own server, or use a separate worktree. Do not bypass a lease; if a crash
leaves one behind, verify its owner and children have exited before removing the
exact stale lease files. Non-Linux process inspection is explicitly limited.

`verify` records results under ignored `.agents/runtime/`; it stops at the first
failed command. `--plan` prints commands without running them. A green profile is
evidence for its scope, not a claim that every feature works. UI changes need real
Chromium interactions and inspected screenshots, including compact/zoomed states
when relevant. Report skipped provider tests separately. Jina/OpenRouter use is
authorized for bounded, relevant live verification; use explicit `--live` with
selected browser tests, never an automatic retry/spending loop.

## Decision boundaries and delegation

Proceed with scoped, reversible implementation choices, regression tests, and
behavior-preserving decomposition. Ask before changing product semantics not
settled by the request, adding dependencies, changing security/retention policy,
deleting non-disposable data, expanding paid-provider use beyond scoped checks,
or making broad cross-feature representation changes.

Commit, push, rebase, merge, deploy, and external messages require authorization
for that task; “evaluate” is not “merge.” Prior requests are not standing permission
to publish unrelated future work. Stage exact owned changes in focused commits.

Delegate bounded independent subtasks when useful and tools permit. Assign each
worker an objective, owned paths, read/write limits, acceptance checks, and a
handoff target. Avoid overlapping writes; one lead owns integration, shared
surfaces, and final verification. Do not spawn agents merely to fill slots.

When user input is necessary, present the decision, concrete context, recommendation
and why, and meaningful alternatives/tradeoffs. Continue independent safe work.

## Handoffs and completion

Use `.agents/tasks/<task-name>/handoff.md`; start with `handoff.mjs`. Keep durable
handoffs in Git alongside the work when committing is authorized. Record scope,
decisions/authority, owned paths, current branch/base, exact verification and skips,
open risks, server/data ownership, and the next executable step. Update on handoff
or material changes, not for every tool call. Keep logs/screenshots in ignored
runtime storage or a task-owned temporary directory and link them, noting local
evidence may not exist on another machine.

Completion means the requested behavior is implemented and proportionately
verified. Report what changed, evidence, remaining limitations, and commit/push
status. Do not modify, remove, or rebuild the existing wiki/reference material as
part of agent onboarding; the replacement Markdown wiki is a separate future task.
