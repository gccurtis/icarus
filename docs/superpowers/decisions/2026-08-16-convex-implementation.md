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

### What adversarial review found, and why it was worth running

Two of these are the reason the verify phase exists at all. Both passed every
check — tests, typecheck, and all four linters were green when they were found.

**Lint checked the scoping rule only on the side that cannot break it.** The
rule is "every registration is built from `projectQuery` or `projectMutation`".
Lint enforced the half that says capabilities may not import `query`/`mutation`
— and never read the doors, where the violation would actually live. A door
registering a bare `mutation()` would have shipped clean. Fixed by reading doors
too, with the `access` exemption moved out of prose and into a named
`UNSCOPED_DOORS` constant in the rules, so granting one is a diff rather than a
sentence somebody wrote.

**`documents` stated two refusals and threw plain `Error` for both.** Convex
serializes a `ConvexError`'s payload to the caller and redacts everything else,
so "document not found" was reaching callers as an opaque server fault — the
capability's whole refusal contract was inert. The tests had asserted on the
message string, which passes either way; they now assert the payload, which is
what would have caught it.

The rest were smaller: three untested `labelFor` branches, an unasserted `list`
projection, a `requireDocument` caller count that said three, and a storage
document naming an index that does not exist.

---

## Pass 2a — Editing

### `FormulaValue` is recursive and a Convex validator is a value, not a type

**Question.** A formula can return a table whose cells are themselves formula
values. There is no recursive validator to write.

**Grounding.** `settings/schema.ts` hit the same wall and stores its value as
JSON text.

**Alternatives.** Bound the recursion at a fixed depth N, writing the definition
N times; encode the whole value as JSON text as settings does; `v.any()` at the
nested cell only, with an honest recursive TypeScript type beside it.

**Chosen.** The third. Settings' answer does not transfer, and the reason is
specific: **the outer `kind` discriminant is read server-side** by anything
resolving a dependency, and JSON text protects nothing that has to be read. This
is the only option whose stored bytes are the shape the model describes — the
kind, the columns, and the fact that rows are rows are all still checked at the
door, and if a recursive validator ever exists it tightens with nothing to
migrate. A fixed depth refuses a legitimate deeper value with no recourse and
makes N a guess.

The accepted cost is that a malformed *nested* cell is storable, so a renderer of
one must be defensive. That is stated in `content/types/types.md` rather than
left for someone to discover.

### The union must grow safely, and the real risk is not what it looks like

**Question.** How do you test that adding `image`, `table`, `embed`, and `prompt`
later cannot disturb `text` and `formula`?

**Alternatives.** Assert the member list by index; assert only that the union has
two members today.

**Chosen.** Look every member up by its `type` literal, and assert **each variant
owns its whole field set** — `fieldsOf('text').expression` is undefined,
`fieldsOf('formula').atoms` is undefined.

An index assertion breaks the moment a member is appended, which is exactly the
change that is supposed to be safe. And the real failure mode is not appending a
member: it is someone later collapsing the union into one wide `v.object` with
per-type optional fields. The field-set assertions are what catch that.

### What adversarial review found

Three defects, all past tests, typecheck, and four green linters. Two are in the
code the plan singled out as the riskiest in the build, which is where the review
weight was deliberately placed.

**Step 3 saw the incoming op's path and nothing else.** Removal containment is
supposed to reject an edit whose subtree an intervening set deleted. Reading only
the path missed the subtree no id names — so two ordinary shapes of collaboration
committed change sets that *could never be applied*, and every subsequent read of
that resource threw, permanently, with no repair path. It now reads a removal's
`values`, refuses a removal that did not say what it took, and tests the anchor an
insert or move is placed by.

**Step 4 shifted a text op's `at` and never its far end**, accepting a
replacement that swallowed an intervening edit — the fails-open failure the plan
warned about, arriving exactly where it was predicted. It also compared a mark's
*display* offsets against a text op's *atom-local* ones, silently moving marks
the edit never reached. The first fix is a second endpoint with the opposite
tie-break; the second is a conversion that needs the body, so it is read once,
last, and only where an incoming mark meets an intervening edit in its own block.

**Deleting a document left its snapshots and change sets behind.** Revisions
scopes off those rows rather than the document row, so the document stayed
readable and writable by anyone holding its id.

---

## Pass 2b — the design claim, tested

### The change-set machinery is generic over `resourceType`, and now that is evidence

**Question.** The whole storage design rests on one claim: an op says
"set `sheets/#sh1/cells/B7`" and the code applying it never inspects the body, so
one snapshot table and one change-set table serve documents, decks, and
workbooks. Task 11 exists to falsify that claim if it is false.

**Result: it holds.** Every appearance of `resourceType` in the revisions `api/`
tree is an index key — `.eq("resourceType", …)` — or a type annotation. There is
no branch on its value anywhere. `applyOps` and `shift` do not mention it at all.
Decks and workbooks did come along nearly free.

Recorded as a result rather than an assumption, because the plan named this the
load-bearing task and "we did not need a special case" is only worth anything if
someone went looking.

### But building sheets found a hole documents never would have

**`touchedBy` understated a keyed insert.** A spreadsheet cell carries no id —
its identity *is* its A1 address, which is the one place the model deliberately
departs from ids-everywhere. So a row insert reported none of the cells it
created, `touched` came back short, and **a concurrent write to one of those
cells passed the entire conflict ladder**. Fixed by naming the keyed entry in the
path, exactly as `remove` already did.

This is the argument for building decks and workbooks in pass 2 rather than pass
6, made concrete. The machinery was generic; its `touched` computation was
incomplete for keyed collections, and only a keyed collection could show that.
Three more passes would have been built on top of it first.

Two documents also claimed enforcement that does not exist: `revisions/types/
types.md` said `submit` enforces the target/op pairing table (only `text → atom`
is stated, and the doc now says what the convention costs), and
`name-manager/types/types.md` said formula never calls `asTable`, which is its
only caller. A document that contradicts its code is worse than none.

---

## Pass 3 — Files and collaboration

### The door fixes the origin; it does not accept it

**Question.** `ExternalFile.origin` is a four-case union — upload, connector,
generated, capture. Does the public `ingest` function take it as an argument?

**Grounding.** `origin` exists to answer "where did these bytes come from", and
it is the record a connector sync and an agent export are traced through.

**Alternatives.** Door accepts `origin: fileOriginValidator`; door fixes
`{kind: "upload"}` and the handler takes the origin for server-side callers; four
separate functions, one per origin.

**Chosen.** The second. **An upload is the only origin a browser can honestly
claim.** Accepting the union at the door would let a project member sign a file
as an agent's export or a connector's pull inside their own project — corrupting
exactly the record `origin` exists to keep. Four functions would give four
near-identical writers free to drift.

The related rule — an upload origin requires a *user* actor — is enforced in
`types/`, not at the door, because the door already supplies a user and the rule
is unreachable there. It exists for the callers arriving in passes 7 and 8, which
reach the handler directly with their own actor. Writing it while the rule is
being stated is cheaper than retrofitting it then, and `ingest.md` says plainly
that the door cannot produce that refusal.

### `by_connector_external` gained a column the spec did not name

**Question.** `storage/README.md` and the task both say the index is
`(connectorId, externalId)`. The global constraint says `projectId` leads every
index on a project-scoped table. Those conflict.

**Chosen.** `(projectId, origin.connectorId, origin.externalId)`. The extra
leading column is free — a connector belongs to one project and every caller is
already inside a project scope — and it makes a read that forgets the project
predicate impossible to write. The name and the matching behaviour are unchanged.

Two things made this more than a preference: the fields live inside the `origin`
union, so the index uses Convex's dotted paths, and that was verified against a
real backend rather than assumed. `schema.ts` and `overview.md` both state the
reconciliation, so the next reader does not re-litigate it against the storage
doc.

### What review found

One finding, and it is the deferred-id sweep paying off: **a slide background's
`fileId` was still `v.string()`** from before `externalFiles` existed, so a deck
body could store an id no file has — while the identical reference in an image
block was checked at the door. Passes leave these deliberately and close them
when the table lands; this is the one that was missed.

Pass 3 came back far cleaner than pass 2a. The rules that earlier reviews turned
up — refusals must be `ConvexError` subclasses, tests assert payloads not
messages, `test/unit/` mirrors source, internal procedures live in `api/shared/` —
are now stated up front in every task, and they are no longer being rediscovered.

---

## Pass 6, settled early

### `knowledge.yaml` values are carried, not invented

**Question.** Both lattice process docs say their tuning belongs in
`app/configuration/`, and no such file existed. Pass 6 would have had to invent
every number.

**Grounding.** `reference/capabilities/knowledge/` is the Taurus Omega runtime
the lattice design is carried from, and it holds the real defaults —
`types.ts` for windowing, clustering, and KNN; `lattice/descent.ts` and
`lattice/knn.ts` for the constants the types do not name.

**Alternatives.** Pick plausible numbers; leave the file for pass 6 to write.

**Chosen.** Every value carried across: window 4000/400, threshold at the 0.75
percentile with a 0.30 floor, `k=32`, `pcaDims=128`, `probeCells=4`,
`maxClusterPool=2000`, repair bounds 0.2/0.02, descent beam 3 at threshold 0.35
with a 256-expansion ceiling, `charBudget` 4000, `topK` 5. The seeds are its
seeds, because a lattice that reshuffles on rebuild makes retrieval
irreproducible and repair impossible to reason about.

Invented numbers would have looked exactly as authoritative and been worth
nothing. The file says in its own comments that these were measured against a
different corpus and are starting points.

This also turned up that `configuration/README.md` claimed everything in the
directory is read, which stopped being true when `revisions.yaml` landed. It now
names both files written ahead of their reader.

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
