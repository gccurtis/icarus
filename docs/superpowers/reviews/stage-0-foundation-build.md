# Stage 0 — how to build it

The design is
[stage-0-foundation-changes.md](stage-0-foundation-changes.md). This is what to
write, where it goes, and what will check it.

**Stage 0 declares no storage.** Three capabilities, no tables, no schema
changes, no deployment doors. On `main` all three are new — it currently holds
`access` and `settings` only.

## What gets created

```text
app/src/lib/capabilities/
├── shared/          cross-cutting types every capability uses
├── content/         the content block union
└── messages/        a message and what it attaches
```

None of them gets a `schema.ts`, an `api/`, or a file under
`src/convex/capabilities/`. A capability with no `api/` needs no deployment door,
and capability lint returns early rather than demanding one.

---

## shared

```text
app/src/lib/capabilities/shared/
├── overview.md
├── types/
│   ├── types.md
│   ├── actor.ts                      Actor
│   ├── mention.ts                    Mention
│   ├── resource.ts                   ResourceKind, ResourceRef, kindMatches
│   ├── resource-set-expression.ts    ResourceSetExpression, Selector, normalize
│   ├── page-setup.ts                 PaperSize, PageSetup
│   └── style-set.ts                  TextStyle, StyleSet
└── test/unit/types/
    ├── actor.test.ts
    ├── mention.test.ts
    ├── resource.test.ts
    ├── resource-set-expression.test.ts
    ├── page-setup.test.ts
    └── style-set.test.ts
```

Two files carry behaviour rather than only shapes, and both need real tests:

**`resource.ts` exports `kindMatches(pattern, kind)`.** Prefix matching on the
`::` boundary — `connector` matches `connector::google-docs-v1`, and
`connector::google` must **not** match `connector::googlesheets`. Match on
segment boundaries, not raw string prefix, or that false positive ships.

**`resource-set-expression.ts` exports `normalize(expression)`.** The four rules
from the design: `project` in `include` drops the other includes; a
`resourceKind` drops the `resource` selectors it prefix-matches from the same
list; a selector in both lists loses its include; duplicates collapse. Normalize
on write, so a stored expression is always canonical and two sets are comparable.

`overview.md` states the boundary: **this capability owns what belongs to no
single table.** A type used by exactly one capability lives with that capability
and promotes here when a second one needs it.

---

## content

```text
app/src/lib/capabilities/content/
├── overview.md
├── types/
│   ├── types.md
│   ├── block.ts       TextAtom, Mark, ContentBlock and its six variants
│   ├── format.ts      BlockFormat
│   └── value.ts       DateValue, FormulaColumn, FormulaValue
└── test/unit/types/
    ├── block.test.ts
    ├── format.test.ts
    └── value.test.ts
```

`block.ts` imports `Mention` from `$shared/types/mention` for the mark, and
`ResourceSetExpression` from `$shared/types/resource-set-expression` for a prompt
block's scope.

**`types.md` must state the two divergences**, because nothing else will say them
and a reader of the validator alone would conclude the type is wrong:

- `TableCell.blocks` is `v.array(v.any())` in the validator and `ContentBlock[]`
  in the type. The recursion is real and a validator is a value, not a type.
- `FormulaValue`'s table rows are the same. Only the `table` member is written
  twice — once inferred, once by hand.

---

## messages

```text
app/src/lib/capabilities/messages/
├── overview.md
├── types/
│   ├── types.md
│   ├── message.ts      Message, MessageRole, MessageState, messageAuthor
│   └── attachment.ts   Attachment
└── test/unit/types/
    ├── message.test.ts
    └── attachment.test.ts
```

**`overview.md` has one job: say why there is no table.** A conversation is never
read outside its consumer and is most of what the consumer is, so
`researchThreads`, `agentTasks`, and `personaThreads` will each hold
`messages: Message[]` when those tables arrive. Without that written down, the
next reader assumes the table was forgotten.

**`messageAuthor(role, author)` is the one piece of behaviour** — a prompt must
name its author, a response need not. It is a function because a validator cannot
express a constraint between two fields, and the test has to prove it throws
rather than just that the happy path returns.

**`attachment.ts` stays here rather than in `shared`** because messages are its
only consumer today. It promotes when a second one appears — findings are the
likely candidate, and they may want excerpts, in which case they are a different
type and this one stays put.

---

## Wiring

Three aliases, each in **both** maps:

```js
// app/svelte.config.js — kit.alias
$shared:   "src/lib/capabilities/shared",
$content:  "src/lib/capabilities/content",
$messages: "src/lib/capabilities/messages",
```

```jsonc
// app/src/convex/tsconfig.json — compilerOptions.paths
"$shared/*":   ["../lib/capabilities/shared/*"],
"$content/*":  ["../lib/capabilities/content/*"],
"$messages/*": ["../lib/capabilities/messages/*"]
```

The Convex bundler does not read SvelteKit's map, which is why both exist. An
alias in one and not the other fails the push rather than the typecheck.

**`src/convex/schema.ts` is not touched.** Nothing here declares a table, so
there is no fragment to add to the spread or the `declared` list.

## What lint enforces

| Rule | Applies here as |
| --- | --- |
| A document per directory, named after it | `overview.md` at each root, `types/types.md` in each `types/` |
| Only `overview.md`, `errors.ts`, `schema.ts` at a capability root | Nothing else at the root — a stray `actor.ts` there fails |
| kebab-case files and directories | `resource-set-expression.ts`, not `resourceSetExpression.ts` |
| No `query` / `mutation` imports under `capabilities/` | Trivially true; there are no handlers |
| Every `$alias` resolves on disk | Both maps, or the push breaks |
| Tests under `test/`, mirroring source | `test/unit/types/` mirrors `types/` |
| `api/` and the deployment door name the same set | Vacuous — no `api/`, so no door |

## Tests

One file per types file, mirroring the source path. Two kinds of assertion, and
the second is what stops a suite reporting success either way:

**Shape pins** — look members up by their `kind` or `type` literal, never by
index, because appending a member is exactly the change that must stay safe.
Assert each variant owns its whole field set: a `text` block has no `expression`,
a `formula` block has no `atoms`. That is what catches the real failure mode,
which is not appending a member but collapsing the union into one wide object
with per-type optional fields.

**Behavioural refusals** — use `validate()` from `convex-helpers/validators`,
already a dependency. Assert what is *rejected*: a text block with no `display`,
an atom with no `id`, a formula atom whose `state` is not one of the four. A test
that only builds a valid value and asserts it back restates the definition.

For `kindMatches` and `normalize`, test the negative cases first —
`connector::google` against `connector::googlesheets`, and an expression that
normalizes to something smaller than it started.

## Verifying

```bash
export PATH="/nix/store/2gf37maq4k2nhidw22dxndccma074cak-nodejs-26.7.0/bin:/nix/store/ry314j51iqvrn8fs26vna9xy823c1swy-pnpm-11.20.0/bin:$PATH"
cd app
pnpm test && pnpm typecheck && pnpm lint
```

A fresh checkout needs `pnpm install`, then `pnpm exec svelte-kit sync` before
anything else — `app/tsconfig.json` extends the generated
`.svelte-kit/tsconfig.json`, and without it every alias fails to resolve.

**No Convex deployment is needed for stage 0.** Nothing is pushed, because
nothing declares a table. `_generated/` must exist for typecheck, which
`convex codegen` produces once `.env.local` names a deployment.

## What stage 0 deliberately leaves

| Deferred to | What |
| --- | --- |
| revisions | `Op`, `OpTarget`, `ResourceKey` — the op vocabulary ships with its tables, including the narrowed per-op target unions |
| spreadsheets | Sheet cells gaining ids, and a range anchored by two corner ids |
| formula | A `formulas` table, immutable formula rows, and blocks holding a `formulaId` |
| access | Nothing — `users` and `projects` already exist on `main` |

Every id in stage 0 is a plain `string`, not `Id<"table">`, so none of the above
requires loosening anything that stage 0 wrote.

## Related

[the design](stage-0-foundation-changes.md) ·
[merge order](../../storage/merge-order.md) ·
[capability directory](../../../app/docs/capability-directory/capability-directory.md)
