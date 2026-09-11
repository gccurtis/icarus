# pure-functions

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Replace prompts with facts; remove inapplicable sections.
Do not include credentials or copy sensitive logs.

## Snapshot

- Updated: 2026-09-11T15:40:42-04:00
- Status: contract approved; PF-01/PF-02 enforcement foundation implemented
  and focused verification green
- Worktree: `/home/jakul/cyberia/icarus-worktrees/pure-functions`
- Branch: `work/pure-functions`
- Head when initialized: `b152b52ddd1fef5dfdaf8e2a4b6d03796cf011fd`
- Current branch head before this dirty slice:
  `6c0a73f048ffaed5622c4a2c18adeed85252c3ad`; dirty paths are the PF-01/PF-02
  checkers/shared analysis, their catalog/tests, and this handoff
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

The follow-up request superseded the prototype design and produced the approved
`contract.md`. The user has now explicitly authorized implementation of that
contract, including the required checker replacement, model/runtime/capability
architecture, generators, migrations, and proportionate behavioral verification.

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
- Prototype composition boundary (superseded by `contract.md`): `bindCapability`
  in `runtime/server/scope.server.ts` is the sole generated remote adapter. It
  resolves authenticated scope, obtains the server model, and supplies a clock
  port.
- Superseding direction under contract: `CapabilityContext` must not carry the
  full model graph. Runtime owns singleton creation, bound model adapters,
  per-use acquisition/release, capability-specific transformation, authentication,
  scope, and remote exposure. Acquired model ports expose operations plus commit,
  but not acquire/release. Every source under capability APIs, model methods, and
  component procedures—including nested helpers—is a closed pure island.
- Model `port.ts` co-locates the exact outer adapter and `bind<Model>()`. Runtime
  alone creates singleton state/infrastructure and binds it. Each acquire returns
  a distinct frozen lease facade with model operations plus commit; release is
  runtime-only, always runs in `finally`, and never commits.
- Normal return is the automatic staged commit vote; throw/cancellation/invalid
  result aborts. Domain refusals are typed failure-atomic results, never exceptions
  classified by message/shape. One invocation has at most one staged commit
  owner; explicit checkpoints are named and require recovery/idempotency evidence.
- The central static registry governs remote and production-internal capability
  calls. Remote calls authenticate and resolve a server-created scope grant;
  capability transformers receive only a fresh exact acquired-model subset.
- User approval received after contract publication: implement the contract. This
  authorizes scoped product/checker changes and focused commits/pushes on
  `work/pure-functions`; it does not authorize integration into `main`.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | Enforcement foundations; model state/ports/runtime builders; Store and one read-only exemplar; capability authority/registry/gateway/adapters/remotes; component procedures/adapters/effects; generators/tests/docs/handoff | Main integration, unrelated product behavior, credentials/development data | Approved contract completion criteria and proportional focused/full verification |

- Worktree workflow: `.agents/skills/icarus-branch-integration/SKILL.md`
- Capability/Store boundary: `.agents/skills/icarus-store-change/SKILL.md`
- Component/model lifetime boundary: `.agents/skills/icarus-editor-change/SKILL.md`
- Existing checker foundations: `app/scripts/lint/shared/tree.mjs`,
  `app/scripts/lint/shared/procedures.mjs`, and
  `app/scripts/lint/cohesive-units/procedure-directory-has-one-entry-chain/effects.mjs`
- Existing contracts most directly affected: BEH-03, BEH-04, AUTH-01, AUTH-05,
  EDGE-01, and the checker catalog/mutation registry.

## Progress and current state

- Approved implementation sequence: (1) replace the prototype with shared
  filesystem/type/provenance enforcement, (2) implement guarded model leases and
  the read-only/Store exemplars, (3) implement central authority/registry/runner
  and migrate capabilities, (4) migrate component procedures/effects and
  generators, then run full certification. Each slice receives a focused commit.
- No new baseline, suppression, compatibility bridge, or scope-exclusion manifest
  is authorized. Full enforcement may report unmigrated code between slices.

- Implemented a single filesystem-derived owner catalog for all capabilities,
  model `methods/` trees, and every discovered component `procedures/` owner.
  It includes nested helpers, excludes tests/fixtures as roots, admits only each
  island's exact local support zone, and fails alternate executable source
  languages closed.
- Implemented a shared TypeScript `Program`, lexical symbol resolver, and module
  graph using the repository Svelte alias map and bundler resolution mode.
- Added unbaselined `pure-island-import-closure` (PF-01): static value/type
  imports, re-exports, relative/alias/package edges, transitive barrels,
  import-type/dynamic/require/triple-slash loading, ambient types/declarations,
  unsupported source forms, unresolved edges, production-to-test edges, and
  symlink escapes are governed. Findings include the shortest discovered source
  chain and resolved target.
- Added unbaselined `pure-island-has-no-ambient-authority` (PF-02): symbol-aware
  ambient access, mutable/effectful module state, `this`/classes/accessors/
  decorators, dynamic evaluation, unsafe assertions/suppressions, broad generic
  authority, detached promises/closures, invalid await provenance, and port
  reflection are rejected. Explicitly supplied parameters remain legal even
  when named like globals; `runtime.body` and `getBody(runtime)` are positive
  fixtures.
- Added batched adversarial mutation coverage for 36 bypasses. The batch keeps
  each attack independently asserted while building only one compiler program
  per checker; the general checker suite retains one canonical mutation per
  checker. The sandbox now supports exact mutation-only symlinks.
- Current intentionally red production inventory: PF-01 reports 5,864 findings;
  PF-02 reports 3,862 findings. Both have `baseline: false`; no finding was
  added to `architecture-baseline.json`.

- Added `.agents/tasks/pure-functions/contract.md`, a normative 17-section
  architecture contract covering target file layout, pure-island syntax/type
  closure, model state/ports/lifetimes, acquire/commit/release semantics, central
  runtime authority/registry/gateway, component adapters/effects, 16 checker
  contracts, executable boundary tests, generators, migration order, and
  completion criteria.
- Performed an adversarial review and incorporated defenses for dependency/type
  laundering, broad/generic ports, model/capability/component behavior relocation,
  exact adapter routing, raw-state aliasing, forged/stale authority, detached
  async work, use-after-release, duplicate/deadlocking acquisitions, false multi-
  model atomicity, invalid-result commits, remote/internal bypasses, and checker
  suppressions.
- Grounded concurrency limitations in the current tree: Store's callback
  transaction cannot be mechanically held across an async lease; Store needs an
  acquisition-local stage and short durable commit. Current Store,
  OperationFlights, and native-file queues do not prove cross-process exclusion.
- Product/runtime/model sources and generators are not changed in this first
  implementation slice. The earlier checker prototype remains temporarily while
  PF-03 through PF-16 replace its remaining field/entry/gateway responsibilities.

Prior prototype state, retained for branch history but superseded by the contract:

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
| `git diff --check` | Contract and handoff documentation | Passed before handoff finalization | Terminal output |
| `node .agents/scripts/verify.mjs agents` | Contract worktree helper invariants | 45/45 passed | `.agents/runtime/runs/1789149219756-agents-187df964` |
| `node --check` on new checker/test modules; `git diff --check` | PF-01/PF-02 source syntax/whitespace | Passed | Terminal output |
| `node --test --test-isolation=none scripts/test/pure-functions.test.mjs` | 36 batched adversarial PF-01/PF-02 bypasses | 2/2 checker batches passed | Terminal output |
| `node --test --test-isolation=none --test-name-pattern='pure islands retain' scripts/test/lint.test.mjs` | Positive field, explicit mutator port, lexical shadow, and local admission boundaries | 2/2 passed | Terminal output |
| `node --test --test-isolation=none scripts/test/lint.test.mjs scripts/test/checker-catalog.test.mjs scripts/test/pure-functions.test.mjs` | Catalog, full checker mutation suite, positive boundaries, and 36 adversarial PF bypasses after lexical-global fix | 273/273 passed | Terminal output |
| `node scripts/lint.mjs pure-island-import-closure \| tail -n 2` | Entire governed production tree, unbaselined | Expected red: 5,864 findings | Terminal output |
| `node scripts/lint.mjs pure-island-has-no-ambient-authority \| tail -n 2` | Entire governed production tree, unbaselined | Expected red: 3,862 findings | Terminal output |

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

- PF-01/PF-02 now provide resolved type/import closure and lexical authority
  enforcement. PF-03 through PF-16, exact leases, registry/gateway, adapter
  grammar, product migration, and their behavioral contracts remain.
- This first enforcement slice does not migrate production findings. The branch
  is intentionally red until governed production complies; integration remains
  blocked on the complete zero-baseline result.
- Store staging, scope-grant revocation semantics, durable checkpoints, and
  single-writer versus multi-process deployment guarantees require executable
  exemplars before broad migration.
- Dependencies and generated tool state are ignored local artifacts. No server,
  Store, browser, or provider test was needed or started.
- Next executable step: commit/push the verified PF-01/PF-02 foundation, then add
  PF-03/PF-04/PF-05 boundary checks and begin the read-only model `state.ts` /
  guarded `port.ts` exemplar before designing the Store stage around its current
  short synchronous durable transaction.

## Publication / handoff

- Commits created by this task: `9bef8e2977f0c7397bb5f45b8afb8bee3ca3eafa`
  (`Enforce explicit-dependency functions`) and
  `fcc92c5e92a7e4330779db387d915240438c8a8d`
  (`Document pure-islands runtime contract`), plus publication-only handoff
  commits
- Push / merge state: contract and publication handoff pushed to
  `origin/work/pure-functions`; no main integration
- Worktree cleanup / retained local artifacts: worktree intentionally retained;
  ignored local-configuration symlink exists
- Next owner and remaining work: lead implements the approved contract in the
  retained worktree; user review is next required only if a new product/security
  semantic decision falls outside the approved contract
