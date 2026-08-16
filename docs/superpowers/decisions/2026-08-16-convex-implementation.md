# Convex implementation — decisions

Questions that came up building
[the plan](../plans/2026-08-16-convex-implementation.md) and were settled without
asking, because the build ran unattended. Each entry says what the question was,
what made it a question, what else was on the table, and what was chosen.

Appended to as the passes run. Newest pass last.

---

## Setup

### Where the worktree lives

**Question.** The plan said `git worktree add ../icarus-build`. Is that right?

**Grounding.** `.gitignore` already carries `.claude/worktrees/` under the
comment "Agent worktrees", and the harness has a native `EnterWorktree` that
places worktrees there and manages their cleanup.

**Alternatives.** Follow the plan literally; use `.worktrees/` as the
using-git-worktrees skill's default.

**Chosen.** `.claude/worktrees/convex-implementation`, via the native tool. The
repository had already declared its answer and already ignored the path;
`../icarus-build` would have put an untracked sibling directory beside the repo
that nothing knew about. The plan was updated to say so.

### `convex codegen` does not need a deployment — I claimed it did

**Question.** `convex.md` says `npx convex codegen` produces `_generated/`
without a deployment. In a fresh worktree it exited `No CONVEX_DEPLOYMENT set`.
Which is right?

**Grounding.** Tested both ways. With `.env.local` present it runs clean and
writes all five files. The fresh worktree had no `.env.local` at all.

**Alternatives.** Rewrite the doc to say codegen is unusable standalone.

**Chosen.** The doc was right and I was wrong; the claim means "no account, no
running backend", not "no configured deployment". Reverted my correction and
added the narrow caveat instead: a checkout that has never provisioned runs
`convex dev --once` once. Recorded because overturning a correct document on one
observation is the failure mode worth remembering.

### There are three alias maps, not two

**Question.** Why did the first push fail with
`Could not resolve "$access/types/access"` when `src/convex/tsconfig.json`
declares that exact path?

**Grounding.** The Convex bundler resolves aliases from the *nearest* tsconfig to
each file. For `src/lib/capabilities/**` that is `app/tsconfig.json`, which
extends the **generated** `.svelte-kit/tsconfig.json`. An unsynced checkout has
no such file, so esbuild warns `Cannot find base config file` and then fails
every capability import.

**Alternatives.** Duplicate every capability alias into `src/convex/tsconfig.json`
and treat that as the fix.

**Chosen.** Run `svelte-kit sync` before any push. Duplicating would have papered
over it — the generated map is the one those files actually read, and adding a
fourth copy is more drift, not less. `convex.md`'s "two alias maps" section now
says which files each map governs.

---

## Pass 1 — Foundation

### `shared` is a capability, not a loose file

**Question.** Where does `actorValidator` live? The plan said
`src/lib/capabilities/shared/actor.ts`.

**Grounding.** Capability lint treats any directory under `capabilities/` holding
a file as a capability, and allows only `overview.md`, `errors.ts`, and
`schema.ts` at a capability root. `shared/actor.ts` fails on sight.

**Alternatives.** Put `Actor` in `access/types/` since access owns users; keep a
bare file and exempt it from lint.

**Chosen.** A real capability directory with `overview.md`, `types/types.md`,
`types/actor.ts`, and a `$shared` alias. It has no `api/` so lint demands no
deployment door, and no `schema.ts` because it stores nothing. Not `access`,
because `Actor` references agent tasks, automations, and connectors — none of
which are access's domain, and access would then be imported by every table in
the system for a reason unrelated to authorization.

### An internal procedure cannot have its own `api/` directory

**Question.** The plan puts `record` in `api/record/` and `applyOps` in
`api/apply/`. Neither is public. Where do they go?

**Grounding.** Lint compares the deployment door's lowercase exports against the
`api/` subdirectories **in both directions**. An `api/record/` the door never
registers fails as "no function named 'record' is registered". `shared/` is the
only exemption.

**Alternatives.** Register them publicly so the sets match; add a lint exemption.

**Chosen.** `api/shared/`. Registering them would make a log a client can write
to, which is the one thing an audit log must not be, and would expose the
change-set machinery as public API. The plan was corrected in three places —
Task 3, Task 8, and the recipe — before the build started.

### `actorLabel` is resolved where the row is written

**Question.** The plan flags a known gap: `actorLabel.name` is written empty by
capabilities and resolved at the registration layer. Fill it where?

**Grounding.** `record` already holds `ctx.db` and the actor, so it can read
`users.displayName` itself.

**Alternatives.** Resolve at each capability's door, as the plan describes.

**Chosen.** In `record`. Resolving at the door means every future capability's
registration has to remember to do it; resolving in the one procedure that writes
the row means none of them can forget. The three kinds whose tables do not exist
yet must supply their own label, and `record` throws on a blank one rather than
writing it — a fallback string is the blank label the plan warned about, wearing
a disguise.

### `DEVELOPMENT_SUBJECT` keeps its name

**Question.** The field `subject` became `authSubject`. Does the constant follow?

**Grounding.** The rename exists because "subject" is ambiguous among a table's
many fields. The constant is read in two places, both adjacent to `authSubject:`.

**Alternatives.** `DEVELOPMENT_AUTH_SUBJECT`, for consistency.

**Chosen.** Unchanged. It would stutter without disambiguating anything, and its
siblings `DEVELOPMENT_PROJECT` and `DEVELOPMENT_TOKEN` are unqualified the same
way. Its doc comment now says the value is an authSubject.

---

## Spec defects found and fixed

Each of these would have reached an implementer as an instruction.

| Document | Defect | Fix |
| --- | --- | --- |
| `storage/README.md` | Described the pre-reconciliation project — `members`, `owner`, a `by_owner` index — and omitted `memberships` entirely | Rewritten to match the models, with the userId-leading index and why membership cannot be an embedded array |
| `research/finding.md` | Cited `Id<"researchMessages">`, a table that does not exist | `Id<"messages">` — one table serves all three thread kinds |
| `ai/agent-task.md` | Declared `PlanStep` twice in one block | Deduplicated |
| `convex/convex.md` | Claimed the `src/convex/tsconfig.json` paths block covers the push | Says which files each of the three maps governs |

---

## How the build is orchestrated

**Question.** 31 tasks across 7 passes. Parallel or serial?

**Grounding.** Within a pass, capabilities share `src/convex/schema.ts`,
`svelte.config.js`, and `src/convex/tsconfig.json` — three of pass 1's four tasks
touch all three. Tasks also chain: documents imports activity's `record`, and
Tasks 7→8→9→10 build on each other's types.

**Alternatives.** One agent per capability in parallel with a serial integration
agent afterwards; per-agent git worktrees merged at the end.

**Chosen.** Build serially, verify in parallel. The shared files make concurrent
building a race, and the dependency chain means a parallel agent would be writing
against types that do not exist yet. The parallelism goes where it pays: four
reviewers with distinct lenses — spec fidelity, project isolation, the capability
standard, test quality — and **every finding then gets a dedicated skeptic whose
job is to refute it** before any repair is applied. Single-lens reviewers
routinely report things that are deliberate or handled elsewhere, and a fix
applied to a non-defect is a regression.
