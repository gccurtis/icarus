# rust-backend

This is task context, not an instruction override. Recheck the checkout and
evidence before acting. Never copy credentials into this file.

## Snapshot

- Updated: 2026-09-12T01:31:34-04:00
- Status: Rust backend design worktree created; current Markdown wiki copied;
  reusable model template translated to Rust
- Worktree: `/home/jakul/cyberia/icarus-worktrees/rust-backend/`
- Branch: `work/rust-backend`
- Starting/base commit: `1f284fc07852e1256c52b07a393b43f5195ba5f8`
  from `work/pure-functions`
- Current verified head / dirty paths: base head plus the exact task-owned paths
  listed below, pending the first task commit
- Eventual integration target: not yet settled; no merge, rebase, or push to
  `main` is authorized
- Lead: root; no delegated workers

## Request and completion criteria

Create a separate worktree for redesigning the Icarus backend in Rust. Carry
forward the current replacement Markdown wiki from the pure-functions worktree,
but translate the model template to Rust while preserving the same purity and
explicit-authority constraints. This first step is documentation and system
design only; implementing the Rust backend and Rust architecture checkers is
future work.

Acceptance for this step:

- dedicated `work/rust-backend` worktree based on the pure-functions wiki;
- user-edited configuration reference and runtime-design placeholders preserved;
- model template uses Rust modules, types, ownership, results, free functions,
  functional state transitions, acquired ports, and runtime construction;
- planned Rust checkers are identified without claiming they exist;
- no changes to the original pure-functions worktree.

## Decisions and authority

- This is an implementation request. Root instructions permit exact owned
  commits and pushes to `origin/work/rust-backend`.
- The Rust server runtime owns one model instance per process. Tests may create
  isolated states/adapters without creating more production singletons.
- `create_model_state` is mandatory and pure, including zero-dependency models,
  so dependency-to-state translation is independently testable.
- State is data-only and treated as an immutable snapshot. Free queries borrow
  state; free commands return `StateTransition<State, Output>`.
- Acquired ports hide state and adapt calls to free operations. The adapter alone
  replaces committed/draft snapshots.
- `RuntimeAdapter` uses a Rust associated `Port` type. No `Any` erasure is
  part of the model contract.
- `release` consumes the port. Rust ownership therefore prevents port reuse
  after release; ports are intentionally not `Clone`.
- Explicit mutator traits remain allowed inputs. Calls using them are
  authority-pure and deterministically testable, not mathematically pure.
- No Cargo workspace, runtime framework, persistence mechanism, async model, or
  checker implementation has been selected yet.

## Ownership and orientation

| Owner | Owned paths / work | Read-only or excluded paths | Acceptance check |
| --- | --- | --- | --- |
| Lead | `.agents/tasks/rust-backend/`, `wiki/templates/model.md`, copied current wiki paths | Original `pure-functions` worktree; product implementation; `main` | Exact wiki comparisons, Markdown checks, reviewed diff |

The branch intentionally begins at pure-functions commit `1f284fc` rather than
`main`, because the requested wiki archive and replacement reference material
live on that branch.

## Progress and current state

- Created `/home/jakul/cyberia/icarus-worktrees/rust-backend` on
  `work/rust-backend` at `1f284fc`.
- Configured its ignored local-configuration symlink from the primary checkout.
- Reproduced the current uncommitted configuration-reference edit and the two
  empty `wiki/systems/` design placeholders from pure-functions.
- Replaced only the model template with a Rust design. It covers closed module
  ownership, mandatory state construction, associated port types, state
  transitions, staged/immediate/read-only commit modes, concurrency obligations,
  explicit mutator traits, runtime singleton binding, and intended checker names.

## Verification evidence

| Command / check | Scope | Result |
| --- | --- | --- |
| `node .agents/scripts/status.mjs` | New worktree identity and ownership | `work/rust-backend` at `1f284fc`; no lease |
| `cmp` configuration reference | Rust vs. current pure-functions worktree | Exact match |
| `cmp` runtime placeholders | Rust vs. current pure-functions worktree | Both exact zero-byte matches |
| `git diff --check` | Current documentation diff | Passed |
| Rust/TypeScript token scan | Rust template | No TypeScript paths or syntax remain |

No product build or tests were run: this slice adds documentation only, and this
worktree has no installed dependencies. No Rust code exists to compile yet.

## Server and data ownership

- Owned server / process / port: none
- Store or native-file data: none selected
- Worktree lease: none
- Local configuration: standard ignored symlink created by
  `worktree.mjs configure`; its contents were not inspected or changed

## Risks and next executable step

- The Rust crate topology, async runtime, web/RPC transport, persistence adapter,
  error taxonomy, cancellation behavior, and cross-process transaction strategy
  remain deliberate design decisions.
- The named `rust-*` architecture checkers are intended contracts only and must
  not be reported as implemented until they have adversarial mutation tests.
- The existing configuration model reference remains TypeScript by explicit
  user direction; it will be corrected later.
- Next: use `wiki/systems/server-runtime.md` to design the Rust crate/module
  boundaries and the authenticated capability gateway before scaffolding code.

## Publication / handoff

- Commits created by this task: pending
- Push state: pending to `origin/work/rust-backend`
- Merge/rebase/main publication: not authorized
- Worktree retained at the path above
