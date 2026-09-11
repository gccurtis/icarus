# pure-functions

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Replace prompts with facts; remove inapplicable sections.
Do not include credentials or copy sensitive logs.

## Snapshot

- Updated: 2026-09-11T11:49:22-04:00
- Status: implemented and verified; pending commit/push
- Worktree: `/home/jakul/cyberia/icarus-worktrees/pure-functions`
- Branch: `work/pure-functions`
- Head when initialized: `b152b52ddd1fef5dfdaf8e2a4b6d03796cf011fd`
- Current verified head / dirty paths: `b152b52ddd1fef5dfdaf8e2a4b6d03796cf011fd`;
  task-owned checker, generator, runtime-adapter, architecture documentation,
  baseline, mutation-test, and handoff changes are dirty pending commit
- Integration target / base SHA, if relevant: `origin/main` / `b152b52ddd1fef5dfdaf8e2a4b6d03796cf011fd`
- Starting worktree/base record: optional `worktree.json` beside this handoff;
  link it when present and verify it against Git
- Lead / delegated workers: root only; no delegation

## Request and completion criteria

Create the `pure-functions` task worktree and discuss checkers that make
capability API operations, model operations, and component procedures explicit-
dependency free functions. Model operations should no longer be attached to the
owned state object; each receives that object explicitly. Effectful calls through
explicitly supplied interfaces remain permitted.

Implement the checker layer now: define the exact syntactic contract, add mutation
proofs, update affected architecture contracts/catalog entries and generators,
and ratchet existing findings without hiding new debt. Product-model and feature
migration is outside this checker-only slice unless a small fixture or generated
template must change to prove the enforcement.

## Decisions and authority

- Current authority: scoped checker implementation on `work/pure-functions`,
  including focused commits and explicit push to that task branch after
  verification. No rebase, merge/push to `main`, destructive data change, or
  deployment is authorized.
- Recommended terminology: "explicit-dependency operation" or "authority-pure",
  not mathematical purity. The functions may deliberately cause effects through
  ports received in their inputs.
- Settled model surface rule: a directly stored field such as `runtime.body` is
  allowed. Getters/accessors are behavior and must instead be free queries such
  as `getBody(runtime)`. Model objects expose no methods, getters, setters, or
  callable properties.
- Composition boundary: `bindCapability` in `runtime/server/scope.server.ts` is
  the sole generated remote adapter. It resolves authenticated scope, obtains the
  server model, and supplies a clock port. Component wiring supplies component-
  procedure ports; procedures may not acquire capabilities or model accessors.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | Checker implementation, mutation fixtures, checker catalog/contracts, governed generators, baseline, and this handoff | Product behavior and model migration beyond checker fixtures | New violations fail; existing violations are exact ratcheted debt; checker mutation suite passes |

- Worktree workflow: `.agents/skills/icarus-branch-integration/SKILL.md`
- Capability/Store boundary: `.agents/skills/icarus-store-change/SKILL.md`
- Component/model lifetime boundary: `.agents/skills/icarus-editor-change/SKILL.md`
- Existing checker foundations: `app/scripts/lint/shared/tree.mjs`,
  `app/scripts/lint/shared/procedures.mjs`, and
  `app/scripts/lint/cohesive-units/procedure-directory-has-one-entry-chain/effects.mjs`
- Existing contracts most directly affected: BEH-03, BEH-04, AUTH-01, AUTH-05,
  EDGE-01, and the checker catalog/mutation registry.

## Progress and current state

- Added one shared TypeScript AST authority analyzer and three BEH-03 checkers:
  `capability-functions-are-explicit`, `model-functions-are-explicit`, and
  `component-procedures-are-explicit`.
- Capability entries must receive `CapabilityContext` first; remote declarations
  must use `bindCapability`; capability APIs cannot import runtime, Node I/O, or
  sibling capability authority or read ambient clocks/globals.
- Model definitions and public contracts allow stored fields but reject methods,
  getters, setters, and callable properties. Model method entries require an
  explicit first input, and all method sources reject ambient/runtime/capability
  authority. The legal boundary is tested with `runtime.body`, `getBody(runtime)`,
  and a supplied mutator port.
- Component procedures reject ambient/browser/process authority, direct remote
  capabilities, runtime access, known model accessors, and `this`; `$effect` is
  allowed only under `procedures/effects/`. Supplied mutator ports remain legal.
- Updated existing scope/validation checkers for explicit capability context;
  updated capability/model generators and architecture documentation/catalog.
  Removed the superseded thin-delegation checker.
- Ratcheted 1,096 pre-existing BEH-03 findings: 471 capability (93 missing
  contexts, 92 unbound remotes, 286 hidden dependencies), 355 model (281
  attached surfaces, 74 hidden dependencies), and 270 component procedure (265
  hidden dependencies, 5 uses of `this`).

## Verification evidence

| Command / check | Tree or scope tested | Result, counts, and skips | Evidence |
| --- | --- | --- | --- |
| `node .agents/scripts/status.mjs` | Primary checkout before setup | Clean `main` at `b152b52d`; process visibility sandbox-limited | Terminal output |
| `node .agents/scripts/worktree.mjs start pure-functions` | Worktree setup | First sandboxed fetch failed; approved retry succeeded | Helper output |
| Read-only `rg`/source inspection | Existing architecture/checker patterns | Design evidence only; no executable verification | Terminal output |
| `node scripts/test/lint.test.mjs` | All architecture-checker mutation tests | 264/264 passed | Terminal output |
| `node --test-name-pattern=model-functions-are-explicit scripts/test/lint.test.mjs` | Model checker after fingerprint refinement | 3/3 passed | Terminal output |
| `node --test-name-pattern='explicit-dependency functions retain' scripts/test/lint.test.mjs` | Positive field/port boundaries | 2/2 passed | Terminal output |
| `node scripts/test/generation.test.mjs` | All governed generators | 15/15 passed | Terminal output |
| `nix develop ./infra/devshell --command node .agents/scripts/verify.mjs quick` | Svelte/TypeScript + all architecture checks | 0 diagnostics; 92 clean checks, 1,218 baselined findings, 0 fresh | `.agents/runtime/runs/1789141741682-quick-d95cfb8e` |
| `node .agents/scripts/verify.mjs agents` | Worktree/agent helpers | 45/45 passed | `.agents/runtime/runs/1789141426521-agents-0de83ffe` |

Record visual states actually inspected and remaining gaps. Link logs/screenshots
in ignored runtime storage or a task-owned temporary directory; local evidence
may not be available in another checkout or on another machine. Never describe
skipped live-provider tests as passing.

## Server and data ownership

- Owned server / process / port: none started
- Store mode and exact directory: none selected
- Native-file directory and reset/cleanup responsibility: none selected
- Worktree lease / active command: none recorded; check status before running
- Human review URL and data notes: none recorded
- Local configuration: helper linked ignored
  `app/configuration/local.yaml` from the primary checkout; contents were not read
  or changed. Tracked YAML remains worktree-owned.

## Risks and next executable step

- The checker is syntactic: it proves where authority is acquired, not that an
  arbitrarily typed supplied port is semantically narrow. Focused types and
  contracts remain responsible for port scope.
- This slice does not migrate the 1,096 pre-existing findings; the baseline makes
  that inventory exact and blocks additions.
- Dependencies and generated tool state are ignored local artifacts. No server,
  Store, browser, or provider test was needed or started.
- Next executable step: run the final quick verification after the last doc/test
  edits, review/stage the exact task paths, then commit and push the work branch.

## Publication / handoff

- Commits created by this task: none yet
- Push / merge state: pending task-branch commit and explicit push; no main integration
- Worktree cleanup / retained local artifacts: worktree intentionally retained;
  ignored local-configuration symlink exists
- Next owner and remaining work: lead owns checker implementation and verification
