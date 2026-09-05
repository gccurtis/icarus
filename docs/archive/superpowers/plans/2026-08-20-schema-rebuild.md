# Schema rebuild — the thirty-five tables

**Status:** plan. Execution is incremental and at the owner's direction; each
stage stops for review, and every discrepancy found in `docs/tables/` is brought
back rather than resolved unilaterally.

## Context

[`docs/tables/`](../../tables/) is authoritative and settled. It describes
thirty-five Convex tables across twenty-three table-owning capabilities, plus two
capabilities (`shared`, `content`) that declare none. `main` holds four tables
across six capabilities.

This is a **rebuild, not a migration**. Where `main` disagrees with
`docs/tables/`, `main` changes. Existing tables are deleted and the new set is
built; no data is carried across, and the local Convex deployment is wiped.

The intended outcome: `pnpm dev:convex` pushes a schema of thirty-five tables,
`pnpm lint` and `pnpm typecheck` pass, and every capability directory carries the
documents the capability standard requires.

## What exists today

| | |
| --- | --- |
| Tables | `users` `projects` `memberships` `settings` |
| Fragments | `accessTables`, `settingsTables`, spread in [`src/convex/schema.ts`](../../../app/src/convex/schema.ts) |
| Capabilities | `access` `content` `messages` `revisions` `settings` `shared` |
| Aliases | 3 tree + 6 capability, in [`svelte.config.js`](../../../app/svelte.config.js) and mirrored in [`src/convex/tsconfig.json`](../../../app/src/convex/tsconfig.json) |
| Only Convex caller | [`src/routes/mock/[project]/+page.svelte`](../../../app/src/routes/mock/) |

## Target

Twenty-five capabilities. Twenty-three declare tables; `shared` and `content`
declare none and have no `schema.ts`.

| Capability | Alias | Fragment | Tables |
| --- | --- | --- | --- |
| `access` | `$access` | `accessTables` | `users` `projects` `memberships` |
| `revisions` | `$revisions` | `revisionsTables` | `resourceSnapshots` `changeSets` |
| `documents` | `$documents` | `documentsTables` | `documents` |
| `slide-decks` | `$slide-decks` | `slideDecksTables` | `slideDecks` |
| `spreadsheets` | `$spreadsheets` | `spreadsheetsTables` | `spreadsheets` `sheetCells` |
| `knowledge` | `$knowledge` | `knowledgeTables` | `latticeNodes` `latticeEdges` `latticeSources` `latticeChanges` |
| `derived-outputs` | `$derived-outputs` | `derivedOutputsTables` | `derivedOutputs` |
| `threads` | `$threads` | `threadsTables` | `threads` `threadParts` |
| `personas` | `$personas` | `personasTables` | `personas` |
| `persona-threads` | `$persona-threads` | `personaThreadsTables` | `personaThreads` |
| `agent-tasks` | `$agent-tasks` | `agentTasksTables` | `agentTasks` |
| `templates` | `$templates` | `templatesTables` | `templates` `templateVersions` |
| `resource-sets` | `$resource-sets` | `resourceSetsTables` | `resourceSets` |
| `connections` | `$connections` | `connectionsTables` | `connectors` `connections` |
| `external-files` | `$external-files` | `externalFilesTables` | `externalFiles` |
| `formulas` | `$formulas` | `formulasTables` | `formulas` `dataBackReferences` |
| `variables` | `$variables` | `variablesTables` | `variables` |
| `questions` | `$questions` | `questionsTables` | `questions` |
| `hypotheses` | `$hypotheses` | `hypothesesTables` | `hypotheses` |
| `findings` | `$findings` | `findingsTables` | `findings` |
| `research-threads` | `$research-threads` | `researchThreadsTables` | `researchThreads` |
| `comments` | `$comments` | `commentsTables` | `commentThreads` `comments` |
| `activity` | `$activity` | `activityTables` | `activity` |
| `content` | `$content` | — | — |
| `shared` | `$shared` | — | — |

**A capability with more than one table gets `schema/`** — one file per table plus
`tables.ts` exporting the fragment and `schema.md` describing them together. One
table keeps `schema.ts` at the root. Nine capabilities get the directory:
`access`, `revisions`, `spreadsheets`, `knowledge`, `threads`, `templates`,
`connections`, `formulas`, `comments`.

## Deleted

- **`settings`** — the whole capability, its two public functions, its door, and
  its table. Settings become a JSON string on `users.settings` and
  `projects.settings`.
- **`messages`** — `Message` moves to `$threads/types/message.ts` as a validator
  with no constructor and no `errors.ts`.
- **`src/routes/mock/`** — the only caller of `api.capabilities.settings.*`.
- **`$shared/types/mention.ts`** — `Mention` moves to `$comments/types/mention.ts`
  with per-variant id fields.
- **`$shared/types/resource-set-expression.ts`** — replaced by
  `$shared/types/resource-selection.ts`.
- **`$revisions/types/op.ts`** and **`$revisions/types/resource.ts`** — merged into
  `$revisions/types/change.ts`.
- **The local Convex deployment's data.** Existing `users` rows have no
  `authSubject`, so the push fails against them. Confirm before wiping.

## One property that shapes the sequence

**The schema pushes once, at the end.** `v.id("agentTasks")` in
`$shared/types/actor.ts` is rejected by Convex until `agentTasks` is declared,
and the reference web is tight — `blockValidator` names `externalFiles` and
`derivedOutputs`, `derivedOutputs` names `latticeNodes`, `actor` names
`agentTasks` and `connections`. Sequencing for pushability is not worth the
distortion.

`v.id`'s type parameter is `TableName extends string`, unconstrained, so
**`pnpm typecheck` and `pnpm lint` do hold at every stage** and are the per-stage
gates. `pnpm dev:convex` is the Stage 12 gate.

## Stages

Each stage ends at a review checkpoint. Nothing proceeds past a decision point
without direction.

### Stage 1 — Make `schema/` legal

- [`app/scripts/lint/capabilities/rules.mjs`](../../../app/scripts/lint/capabilities/rules.mjs):
  `"schema"` joins `ALLOWED_DIRS`. The comment on `ALLOWED_ROOT_FILES` currently
  argues one file is enough — it is rewritten to state both forms and when each
  applies.
- [`app/scripts/lint/capabilities/test/`](../../../app/scripts/lint/capabilities/test/):
  a fixture proving a `schema/` directory passes and that it is still required to
  carry `schema.md`.
- [`docs/capability-directory/capability-directory.md`](../../../app/docs/capability-directory/capability-directory.md):
  the template gains the `schema/` form.
- **New:** `docs/capability-directory/templates/schema.md` — the standard has no
  template for this document, and twenty-three capabilities are about to need
  one. Added to the table in `templates.md`.

**Gate:** `pnpm lint && pnpm test:scripts`.

### Stage 2 — `shared` and `content`

No tables. This is the vocabulary every later stage imports.

`$shared/types/`: rewrite `actor.ts` (per-variant `v.id` fields; `task`/`persona`
become `agent`/`connection`), rewrite `resource.ts`, add `resource-selection.ts`
and `file-subkind.ts`, keep `page-setup.ts` and `style-set.ts`, delete
`mention.ts` and `resource-set-expression.ts`.

`$content/types/`: rewrite `block.ts` (drops the mention import, gains the
`prompt` variant and `resourceSelectionValidator`), keep `format.ts` and
`value.ts`.

Rewrite `shared/overview.md`, `shared/types/types.md`, `content/overview.md`,
`content/types/types.md` to the template. Rewrite the affected tests under each
capability's `test/unit/types/`.

> **Decision point — copilot.** Deleting `resource-set-expression.ts` breaks
> eight files under [`$model/client/copilot`](../../../app/src/lib/model/client/copilot/)
> plus its tests. `SetTerm` has no `part` or `web` arm and there is no
> `normalize`. Options and their costs come back here before the file is deleted.

**Gate:** `pnpm lint && pnpm typecheck && pnpm test`.

### Stage 3 — `access`

`schema.ts` becomes `schema/{users,projects,memberships,tables}.ts` + `schema.md`.
`users.subject` → `authSubject`, index `by_subject` → `by_auth_subject`; `users`
gains `email`, `imageUrl`, `settings`, `updatedAt`; `projects` gains
`description`, `archivedAt`, `revision`, `settings`, `lattice`, `updatedAt`.

[`seed.ts`](../../../app/src/lib/capabilities/access/api/seed/seed.ts) and
[`resolve-scope.ts`](../../../app/src/lib/capabilities/access/api/shared/resolve-scope.ts)
follow the renamed index and write the new required fields. `access/overview.md`
and `access/types/types.md` are rewritten to the template.

**Gate:** `pnpm lint && pnpm typecheck && pnpm test`.

### Stage 4 — Delete `settings`, `messages`, and the mock route

Remove both capability directories, [`src/convex/capabilities/settings.ts`](../../../app/src/convex/capabilities/settings.ts),
[`src/routes/mock/`](../../../app/src/routes/mock/), the two aliases from both
alias maps, and `settingsTables` from both places it appears in
[`src/convex/schema.ts`](../../../app/src/convex/schema.ts).

**Gate:** `pnpm lint && pnpm typecheck && pnpm test`.

### Stages 5–11 — The tables

Each stage is the same shape: create the capability directory, write its
`schema.ts` or `schema/`, write its `types/`, write `overview.md` +
`types/types.md` + `schema.md` to the template, add the alias to **both** alias
maps, and add the fragment to **both** places in `src/convex/schema.ts`.

| Stage | Capabilities |
| --- | --- |
| 5 | `revisions` `documents` `slide-decks` `spreadsheets` |
| 6 | `knowledge` `derived-outputs` |
| 7 | `threads` `personas` `persona-threads` `agent-tasks` |
| 8 | `external-files` `connections` |
| 9 | `resource-sets` `templates` |
| 10 | `formulas` `variables` |
| 11 | `questions` `hypotheses` `findings` `research-threads` `comments` `activity` |

> **Decision point — resource runtimes (Stage 5).** `$revisions/types/op.ts` and
> `resource.ts` merge into `change.ts`, which thirteen files under
> [`$model/client/resource-runtimes`](../../../app/src/lib/model/client/resource-runtimes/)
> and `workbench` import. Three specifics come back here: the new `insert` op has
> no `ids`, which [`invert.ts`](../../../app/src/lib/model/client/resource-runtimes/methods/history/invert.ts#L32)
> needs to invert an insert into a remove; targets become per-op unions rather
> than one flat `OpTarget`; and `ResourceKey` and `GENERAL_RESOURCE_TYPES` appear
> nowhere in `docs/tables/`.

**Gate per stage:** `pnpm lint && pnpm typecheck && pnpm test`.

### Stage 12 — Close out

- [`app/configuration/agents.yaml`](../../../app/configuration/) — `maxMessagesPerThread`,
  named by [threads.md](../../tables/threads.md).
- Confirm, then wipe the local Convex deployment's data.
- `pnpm dev:convex` — the first push of the full schema.
- `pnpm seed`, then confirm the app renders.
- Update [`README.md`](../../../README.md)'s account of what the deployment holds.

## Reused, not rewritten

- [`projectQuery` / `projectMutation`](../../../app/src/convex/functions.ts) —
  unchanged. No stage adds a public function, so `src/convex/capabilities/` gains
  nothing and loses `settings.ts`.
- [`resolveScope`](../../../app/src/lib/capabilities/access/api/shared/resolve-scope.ts) —
  the index rename is the only change.
- The duplicate-name check in [`src/convex/schema.ts`](../../../app/src/convex/schema.ts#L27)
  — it already catches two capabilities claiming one table name, which is worth
  having across twenty-three fragments.
- [`kindMatches`](../../../app/src/lib/capabilities/shared/types/resource.ts) —
  the new `resource.ts` keeps it verbatim.
- `pageSetupValidator` and `styleSetValidator` — unchanged by the rebuild.

## Verification

Per stage, from `app/` inside the nix devshell:

```bash
pnpm lint          # capability, model, view, style linters
pnpm typecheck     # svelte-check over the whole project, tests included
pnpm test          # vitest
pnpm test:scripts  # the lint rules' own tests
```

At Stage 12:

```bash
pnpm dev:convex    # pushes the schema; a bad v.id table name fails here
pnpm seed          # capabilities/access:seed
pnpm dev           # second terminal, :3000
```

The schema is correct when the push reports thirty-five tables, `pnpm seed`
returns a token, and `capability lint` reports twenty-five capabilities on the
template.

## Open discrepancies

Carried, not resolved. Each is raised at the stage that reaches it.

| Where | What |
| --- | --- |
| [data.md](../../tables/data.md) | `VariableValue` names `Id<"formulas">` with no `Id` import |
| [revisions.md](../../tables/revisions.md) | `insert` has no `ids`; the doc claims every op is closed under inversion, but inverting an insert then requires reading an id out of an opaque `v.any()` value |
| [resources.md](../../tables/resources.md) | the `slideDecks` snippet omits its import block |
| [capability-directory.md](../../../app/docs/capability-directory/capability-directory.md) | "cross-capability imports use the bare alias only" — every snippet in `docs/tables/` uses subpaths (`$shared/types/actor`), as does the code on `main`. The rule is not machine-checked; the practice contradicts the text |
| [investigation.md](../../tables/investigation.md) · [knowledge.md](../../tables/knowledge.md) | two different `evidenceValidator`s, in `$hypotheses` and `$derived-outputs`. Legal, and worth confirming it is deliberate |
| Several | `Files` sections omit `overview.md`, which lint requires of every capability |

## Related

[all tables](../../tables/README.md) ·
[the capability standard](../../../app/docs/capability-directory/capability-directory.md)
