# Data

Three tables: an expression, a named value, and the index that answers who is
using either.

`formulas` · `variables` · `dataBackReferences`

Everything that computes points at a formula, and everything a formula names is
either a cell or a variable:

```text
content block ──formulaId──▶ formula
sheet cell    ──formulaId──▶ formula

formula.representation names:
  literals                 a number, text, a boolean
  a cell                   one cell, qualified by its resource
  a range                  two corner cells
  a name  ─────────────────▶ variable
  a call                   a builtin, or a name resolving to a function variable

variable.value:
  scalar · list · record · table
  function  ──formulaId───▶ formula
  reference ───────────────▶ another variable, or a resource
```

---

## `formulas`

`app/src/lib/capabilities/formulas/schema/formulas.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { formulaUseValidator } from "$formulas/types/use";

/**
 * One expression, stored in the form that survives the page moving under it.
 *
 * **Scoped to the project, not to a resource.** A document's prose, a slide, and
 * a spreadsheet cell all compute, and a formula that belonged to one of them
 * would be a formula the other two could not hold.
 *
 * **`representation` holds positions as ids, never as addresses.** An address is
 * where something currently sits: inserting a row above `A1:B10` has to make it
 * mean `A1:B11`, and text cannot do that without every formula in the resource
 * being rewritten on every structural edit. Two corner *cell ids* need no
 * rewriting at all — the corners have not moved, and what lies between them now
 * includes another row.
 *
 * A cell is named by its resource, its row, and its column — never by an
 * address. Rows and columns are entries in the sheet's body whose ids do not
 * change when one is inserted above them, which is what makes the reference
 * survive.
 *
 * **A string, and what is inside it is the capability's business.** Serialized
 * tree or its own notation, the column is the same — and a parser's node set
 * changes far more often than a schema should.
 *
 * **Nothing computed is here.** A value is produced from this and the state
 * around it; storing one would be storing an answer to a question that keeps
 * changing. A consumer that keeps a copy — a formula atom holding what it last
 * rendered — is caching, and that is its own row's business.
 *
 * **No validity state.** An expression that does not parse never becomes a row,
 * so there is nothing here to say a formula is broken.
 */
export const formulas = defineTable({
  projectId: v.id("projects"),
  representation: v.string(),
  /** Where this formula is held. Looked up by this row's own id, so a list. */
  usedBy: v.array(formulaUseValidator),
  updatedAt: v.number()
}).index("by_project", ["projectId"]);
```

`app/src/lib/capabilities/formulas/types/use.ts`

```ts
import { v, type Infer } from "convex/values";
import { resourceRefValidator } from "$shared/types/resource";

/**
 * One place a formula is held.
 *
 * **A list on the row rather than rows of its own**, because the lookup key is
 * the formula's own id — nothing has to be indexed to read it back.
 * [`dataBackReferences`](#databackreferences) exists precisely because the other
 * direction does not have that property.
 *
 * `path` addresses the cell or the block inside the resource, in the same form
 * an op's path takes.
 */
export const formulaUseValidator = v.union(
  v.object({
    in: v.literal("resource"),
    ref: resourceRefValidator,
    path: v.string()
  }),
  v.object({ in: v.literal("variable"), name: v.string() })
);

export type FormulaUse = Infer<typeof formulaUseValidator>;
```

---

## `variables`

`app/src/lib/capabilities/variables/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { valueTypeValidator, variableValueValidator } from "$variables/types/value";
import { actorValidator } from "$shared/types/actor";

/**
 * The project's named values, and nothing about how any of them was arrived at.
 *
 * **One name, and it is both what is displayed and what is written.** A name
 * carries no spaces — `=TargetMargin * 2` parses unambiguously only because a
 * bare name cannot contain one — so there is no second, folded form to keep in
 * step with the first. It follows that names are case-sensitive: `TargetMargin`
 * and `targetmargin` are two variables.
 *
 * **`declaredType` is kept although `value.kind` implies it**, because it is the
 * one thing an index can serve. Deriving it would make "every table variable in
 * this project" a read of all of them.
 *
 * `by_project_and_name` carries the uniqueness of a name within a project.
 * Convex has no unique index, so the mutation upholds it — read then insert, in
 * one serializable transaction. The same index sorts a project's variables by
 * name, which is the only order anything needs.
 */
export const variablesTables = {
  variables: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    declaredType: valueTypeValidator,
    value: variableValueValidator,
    createdBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project_and_name", ["projectId", "name"])
};
```

### What a name can hold

`app/src/lib/capabilities/variables/types/value.ts`

```ts
import { v, type Infer } from "convex/values";
import { formulaValueValidator, type FormulaValue } from "$content/types/value";
import { resourceRefValidator, type ResourceRef } from "$shared/types/resource";

/** What kind of thing a name holds, in the author's vocabulary. */
export const valueTypeValidator = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("logic"),
  v.literal("date"),
  v.literal("null"),
  v.literal("list"),
  v.literal("record"),
  v.literal("table"),
  v.literal("function"),
  v.literal("reference")
);

export type ValueType = Infer<typeof valueTypeValidator>;

/**
 * What a name holds: a formula value, plus the four shapes a formula cannot
 * return.
 *
 * Built from [`formulaValueValidator`](content.md#formulavalue) rather than
 * beside it, so a stored `42` and a computed `42` are the same value and nothing
 * converts between them.
 *
 * **A `reference` is not a copy.** It resolves when it is asked for — a name
 * walks to another variable and keeps walking until it reaches a value, a
 * resource ref becomes a table. Storing what it currently resolves to would make
 * an alias a snapshot, which is the one thing an alias is not.
 *
 * **A `function` names a formula rather than carrying text**, so every
 * expression in the schema is a row and none is a loose string.
 *
 * `v.any()` at the leaves for the reason [content](content.md#formulavalue)
 * states: the recursion is real and a validator is a value, not a type.
 */
export const variableValueValidator = v.union(
  ...formulaValueValidator.members,
  v.object({ kind: v.literal("list"), values: v.array(v.any()) }),
  v.object({ kind: v.literal("record"), fields: v.record(v.string(), v.any()) }),
  v.object({
    kind: v.literal("function"),
    parameters: v.array(v.string()),
    formulaId: v.id("formulas")
  }),
  v.object({
    kind: v.literal("reference"),
    target: v.union(
      v.object({ to: v.literal("variable"), name: v.string() }),
      v.object({ to: v.literal("resource"), ref: resourceRefValidator })
    )
  })
);

/** The recursion the validator cannot state. */
export type VariableValue =
  | FormulaValue
  | { kind: "list"; values: VariableValue[] }
  | { kind: "record"; fields: Record<string, VariableValue> }
  | { kind: "function"; parameters: string[]; formulaId: Id<"formulas"> }
  | {
      kind: "reference";
      target: { to: "variable"; name: string } | { to: "resource"; ref: ResourceRef };
    };
```

**Two vocabularies meet on the row**, and the mapping between them is fixed: an
author declares `logic` and `null` where a value carries content's `boolean` and
`empty`. Every other name is the same on both sides.

---

## `dataBackReferences`

`app/src/lib/capabilities/formulas/schema/data-back-references.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * One thing a formula names, indexed from the thing's end.
 *
 * **Named for the target rather than the source, because the target is the key.**
 * The question is "where is this cell used" and "where is this name used" — a
 * formula is only the answer.
 *
 * **A row per reference rather than a list on the formula.** Convex indexes a
 * field's whole value and has no membership test over an array, so a
 * `targets: string[]` column could be stored and never searched: answering from
 * the target's end would read every formula in the project. Fanning the column
 * out into rows is the only shape an index can serve.
 *
 * That is also why this exists and `formulas.usedBy` does not need to: that
 * direction is keyed by the formula's own id, and this one is not.
 *
 * **A range keeps its corners and nothing between them.** What a range covers
 * depends on where its corners currently sit, so recording the cells inside it
 * would be recording a fact that changes without this row being touched.
 *
 * Range containment is the one question the index cannot answer — it is
 * two-dimensional, and an index key is a line. It narrows to the ranges of one
 * resource rather than every formula in the project, which is the difference
 * between thousands and hundreds of thousands.
 */
export const dataBackReferences = defineTable({
  projectId: v.id("projects"),
  formulaId: v.id("formulas"),
  targetKind: v.union(v.literal("cell"), v.literal("range"), v.literal("name")),
  /** A qualified cell position, a range's first corner, or a variable's name. */
  target: v.string(),
  /** The other corner. Ranges only. */
  to: v.optional(v.string()),
  updatedAt: v.number()
})
  .index("by_target", ["projectId", "targetKind", "target"])
  .index("by_formula", ["projectId", "formulaId"]);
```

`by_formula` is what makes a formula's rows replaceable when its representation
changes — without it, rewriting a formula could not find the rows it invalidated.

---

## Neither structure is what makes a value refresh

A query that renders a resource reads its body **and** the formula rows the body
names, so both are in its read set and Convex re-runs it when either changes. No
dependency graph is walked and none is maintained for that purpose.

`usedBy` and `dataBackReferences` answer questions a person asks — what holds
this formula, what reads this cell — and nothing else depends on them.

---

## Where a row can grow

`variables.value` has no ceiling: a variable holding a table is as large as the
table. It is not split into parts. A bound on it is a decision about what a
project may hold rather than about what a row can store, so it is set where the
value is accepted.

`formulas.usedBy` grows with the number of places holding one formula. Each entry
is small, and the case that grows is a named function used widely.

---

## Files

```text
app/src/lib/capabilities/formulas/
├── overview.md
├── schema/
│   ├── schema.md
│   ├── formulas.ts
│   ├── data-back-references.ts
│   └── tables.ts                   formulasTables
└── types/
    ├── types.md
    └── use.ts                      FormulaUse

app/src/lib/capabilities/variables/
├── overview.md
├── schema.ts                       variablesTables
└── types/
    ├── types.md
    └── value.ts                    ValueType, VariableValue
```

Two tables in `formulas`, so `schema/` is a directory; one in `variables`, so
`schema.ts` is a file. See
[the convention](README.md#schemas-are-a-directory-one-file-per-table).

### Registering both

Two alias maps, or the push fails — the Convex bundler resolves `paths` from the
nearest `tsconfig.json` and does not read `svelte.config.js`.

```js
// app/svelte.config.js
      $formulas: "src/lib/capabilities/formulas",
      $variables: "src/lib/capabilities/variables",
```

```json
// app/src/convex/tsconfig.json
      "$formulas/*": ["../lib/capabilities/formulas/*"],
      "$variables/*": ["../lib/capabilities/variables/*"],
```

```ts
// app/src/convex/schema.ts — the fragment list appears twice
import { formulasTables } from "$formulas/schema/tables";
import { variablesTables } from "$variables/schema";
```

**Imports it does not define:** [`$shared/types/actor`](shared.md#actor),
[`$shared/types/resource`](resource-sets.md#the-vocabulary),
[`$content/types/value`](content.md#formulavalue).

## Related

[all tables](README.md) · [resources](resources.md) · [content](content.md)
