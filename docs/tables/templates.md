# Templates

Two tables: a starting point for a resource, and the undo stack for editing one.

`templates` · `templateVersions`

**A template belongs to a person, not a project.** It is made out of a resource —
you are looking at a deck and you save it as one — and then carried into whatever
project you want another like it. That is why `templates` sits outside project
scope alongside [`users`, `projects`, and `memberships`](access.md), and why a
template's fill-in-the-blanks are expressed in terms that mean something in any
project.

---

## `templates`

`app/src/lib/capabilities/templates/schema/templates.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";
import { templateBodyValidator } from "$templates/types/body";
import { templateKindValidator } from "$templates/types/kind";
import { templateVariableValidator } from "$templates/types/variable";

/**
 * A resource you can make more of.
 *
 * **The body is on the row**, unlike a general resource's. A template is not
 * collaboratively edited and no change set addresses it, so there is nothing to
 * replay and nothing to consolidate — the row holds the finished body and that
 * is the whole story. `revision` is the compare-and-swap that keeps two editors
 * from overwriting each other.
 *
 * **`userId` is the owner and the index key.** `createdBy` is beside it because
 * an agent can produce a template, and the two answer different questions: who
 * it belongs to, and what put it there.
 *
 * One index serving two reads. `[userId, kind]` is "my deck templates", and its
 * `userId` prefix is "everything of mine" — a second index would hold the same
 * rows in the same order.
 */
export const templates = defineTable({
  userId: v.id("users"),
  kind: templateKindValidator,
  name: v.string(),
  description: v.optional(v.string()),
  /** Flat library labels. An empty array means untagged. */
  tags: v.array(v.string()),
  body: templateBodyValidator,
  variables: v.array(templateVariableValidator),
  createdBy: actorValidator,
  revision: v.number(),
  updatedAt: v.number()
}).index("by_user_and_kind", ["userId", "kind"]);
```

### What kind it is

`app/src/lib/capabilities/templates/types/kind.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * What the author made, which is not the same as which body it holds.
 *
 * **`deck` and `slide` both carry a slides body.** A single-slide template is a
 * deck body holding one slide, because that is what carries the theme and the
 * layouts it has to be previewed against. Counting slides would be the wrong
 * test — a one-slide deck template is a perfectly ordinary thing.
 *
 * So the pair cannot be derived in either direction and both are stored: a
 * picker lists slides separately from decks without opening a body, and a body
 * still says which of the three it is.
 */
export const templateKindValidator = v.union(
  v.literal("document"),
  v.literal("deck"),
  v.literal("slide"),
  v.literal("spreadsheet")
);

export type TemplateKind = Infer<typeof templateKindValidator>;
```

### What it asks for

`app/src/lib/capabilities/templates/types/variable.ts`

```ts
import { v, type Infer } from "convex/values";
import { portableSelectionValidator } from "$shared/types/resource-selection";

/**
 * One question a template asks when it is instantiated, and the prompt blocks
 * the answer is written into.
 *
 * **A variable is consumed at instantiation.** The answer becomes an ordinary
 * `scope` on each listed block, so the created resource holds real selections
 * and nothing resolves a variable afterwards. This is why
 * [`ResourceSelection`](resource-sets.md#the-selection) has no variable term:
 * nothing ever reads one.
 *
 * **`blocks` lives here rather than a key living on the block**, so a template
 * needs no template-only field inside a content type every body shares. It also
 * buys the thing that makes a variable worth having: several blocks listed under
 * one variable are asked once and answered once, which is how a document keeps
 * one prompt and changes what it draws on.
 *
 * **A default may only use portable terms.** `project` and `kinds` carry no id,
 * so they mean something in whatever project the template lands in; a default
 * naming specific resources would resolve to nothing anywhere else.
 */
export const templateVariableValidator = v.object({
  key: v.string(),
  /** What the person filling it in is asked. */
  label: v.string(),
  description: v.optional(v.string()),
  default: v.optional(portableSelectionValidator),
  /** Prompt block ids in this template's body. */
  blocks: v.array(v.string())
});

export type TemplateVariable = Infer<typeof templateVariableValidator>;
```

### What it holds

`app/src/lib/capabilities/templates/types/body.ts`

```ts
import { v, type Infer } from "convex/values";
import { documentBodyValidator } from "$documents/types/body";
import { slideDeckBodyValidator } from "$slide-decks/types/body";
import { spreadsheetTemplateValidator } from "$templates/types/spreadsheet";

/**
 * A template's body is a real resource body with a label on it — for a document
 * and a deck, their own validators spread beside a `resource` literal.
 *
 * **Spread rather than nested**, because the body *is* the thing it makes: a
 * template is authored in the ordinary editor, and a generic representation
 * every resource had to be projected into would need a converter per type and
 * would drift from what the resources actually store.
 *
 * **`resource` rather than `target`**, because the row's `kind` already answers
 * what the author made. This one answers which of the three shapes is here, and
 * two names keep the two questions apart.
 *
 * `aspectRatio` rides on the slides member because a deck's shape lives on its
 * row rather than in its body, so a slides template that did not carry one could
 * not say what shape of deck it makes.
 *
 * **A spreadsheet is the exception, and it has to be.** Its content is not in
 * its body — cells are rows in `sheetCells`, keyed by ids that exist only inside
 * one resource. So a spreadsheet template is a *projection* rather than a copy,
 * and it has its own shape.
 */
export const templateBodyValidator = v.union(
  v.object({ resource: v.literal("document"), ...documentBodyValidator.fields }),
  v.object({
    resource: v.literal("slides"),
    aspectRatio: v.union(v.literal("16:9"), v.literal("4:3")),
    ...slideDeckBodyValidator.fields
  }),
  v.object({
    resource: v.literal("spreadsheet"),
    ...spreadsheetTemplateValidator.fields
  })
);

export type TemplateBody = Infer<typeof templateBodyValidator>;
```

### A spreadsheet template

`app/src/lib/capabilities/templates/types/spreadsheet.ts`

```ts
import { v, type Infer } from "convex/values";
import { markValidator } from "$content/types/block";
import { blockFormatValidator } from "$content/types/format";
import { formulaValueValidator } from "$content/types/value";
import { cellKindValidator } from "$spreadsheets/types/cell";
import { pageSetupValidator } from "$shared/types/page-setup";
import { styleSetValidator } from "$shared/types/style-set";

/**
 * One cell as a template holds it.
 *
 * **An expression rather than a `formulaId`.** A formula is a row scoped to one
 * project, and its stored form names that project's rows and columns — none of
 * which exists where a template lands. The text an author wrote is the portable
 * form, the same way a picture keeps a storage id rather than a file row.
 *
 * `merge` is a far corner *address* for the same reason.
 */
export const templateCellValidator = v.object({
  kind: cellKindValidator,
  text: v.optional(v.string()),
  value: v.optional(formulaValueValidator),
  /** The expression as authored, when the cell computes. */
  expression: v.optional(v.string()),
  marks: v.optional(v.array(markValidator)),
  format: v.optional(blockFormatValidator),
  /** "D4" — the far corner of a merge. */
  merge: v.optional(v.string())
});

export type TemplateCell = Infer<typeof templateCellValidator>;

/**
 * A spreadsheet as a template holds it: **addressed, never identified.**
 *
 * A live grid names its rows and columns by ids that exist only in that
 * resource, and holds its cells in a separate table. A template has no resource
 * and no rows to point at, so everything here is keyed by the address a person
 * reads — `"B7"`, `"A"`, `"3"` — and there is nothing in it that can dangle.
 *
 * **Which makes this the one template body that is a projection rather than a
 * copy.** A document template and a deck template are their resource's body
 * verbatim; this one is built from a grid and rebuilt into one.
 */
export const spreadsheetTemplateValidator = v.object({
  cells: v.record(v.string(), templateCellValidator),
  /** Keyed by the ruler label — "A", "3". */
  columnWidths: v.optional(v.record(v.string(), v.number())),
  rowHeights: v.optional(v.record(v.string(), v.number())),
  formatRules: v.array(
    v.object({
      from: v.string(),
      to: v.string(),
      style: v.optional(v.string()),
      format: v.optional(blockFormatValidator)
    })
  ),
  frozenRows: v.optional(v.number()),
  frozenColumns: v.optional(v.number()),
  print: v.object({
    page: pageSetupValidator,
    area: v.optional(v.object({ from: v.string(), to: v.string() })),
    repeatRows: v.optional(v.string()),
    repeatColumns: v.optional(v.string()),
    scale: v.optional(
      v.union(v.number(), v.literal("fit-width"), v.literal("fit-page"))
    ),
    gridlines: v.optional(v.boolean()),
    headings: v.optional(v.boolean())
  }),
  styles: styleSetValidator
});

export type SpreadsheetTemplate = Infer<typeof spreadsheetTemplateValidator>;
```

---

## `templateVersions`

`app/src/lib/capabilities/templates/schema/template-versions.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { templateBodyValidator } from "$templates/types/body";
import { templateVariableValidator } from "$templates/types/variable";

/**
 * What a template was, one row per edit.
 *
 * **A table rather than a field**, because each entry is a whole body and a
 * handful of them would not fit in the 1 MiB the template row already spends on
 * one.
 *
 * A row is a complete restorable state, so undo is a read and a write rather
 * than a reverse-op to compute. `kind` and `userId` are absent because neither
 * can change: what a template makes and who owns it are what it *is*.
 *
 * **No `projectId` and no `userId`.** A version is reachable only through its
 * template, so the template's owner is the authorization, read in the same
 * mutation that touches this row.
 */
export const templateVersions = defineTable({
  templateId: v.id("templates"),
  /** The revision this state *was*, not the one that replaced it. */
  revision: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  tags: v.array(v.string()),
  body: templateBodyValidator,
  variables: v.array(templateVariableValidator),
  at: v.number()
}).index("by_template", ["templateId", "revision"]);
```

`revision` counts within one template rather than globally, and uniqueness of the
pair is the transaction's rather than an index's — Convex has no unique
constraint, so a writer reads the maximum and inserts one above it, and a writer
that commits first invalidates the other's read set and makes it re-run.

---

## Three rules the tables cannot state

**A name is trimmed and never empty.** A template is only ever reached by picking
it out of a list, so an unnamed one is a row nobody can choose again.

**`kind` and `body.resource` agree.** `document` and `spreadsheet` map to
themselves; `deck` and `slide` both mean a slides body.

**A variable's keys are distinct, and its `blocks` name prompt blocks that exist
in the body.** A repeated key would make two questions claim one answer, and a
`blocks` entry pointing at nothing is a question whose answer goes nowhere.

---

## What a prompt block needs to be storable here

A prompt block is written into a template body with everything project-bound
stripped out of it, which is why two of its fields are optional in
[the content model](content.md#the-six-variants):

**`derivedOutputId` is optional**, because a template's prompt block points at no
output — the one it had belonged to the project it was saved from. **`state`
includes `idle`** for the same block. Both are true independently of templates: a
block that has never run has nothing to point at and is in none of the other four
states, which makes a prompt block's states the derived output's five exactly.

`scope` was already optional, so clearing it is free. That clearing is the same
step as creating the variable: for each prompt block, drop the scope and add it
to a variable's `blocks`.

---

## Where a row can grow

`templates.body` and `templateVersions.body` are both a whole resource body, and
nothing bounds one. Neither is split across parts the way
[`resourceSnapshots`](revisions.md) is — a template is written whole and read
whole, so a part scheme would buy nothing until a body actually exceeds 1 MiB.

A spreadsheet template is the one most likely to reach it, because its cells are
inline here rather than rows in a table. A template of a few thousand cells is
comfortable; a template of a working data sheet is not, and is not what a
template is for.

---

## Not here yet

**A spreadsheet template carries values, not prompts.** A prompt block in a
document template becomes a variable and a hole for someone to fill. A cell has
no equivalent, because it holds a value rather than a block. When derived content
reaches cells, a template cell gains what a prompt block already has — a key, a
label, and a selection supplied at instantiation.

**Named values are not template variables.** A project's names live in
[`variables`](data.md), so naming a region of a sheet and having a template ask
what it should be is a natural extension and a deliberate absence.

---

## Files

```text
app/src/lib/capabilities/templates/schema/
├── schema.md
├── templates.ts
├── template-versions.ts
└── tables.ts                       templatesTables

app/src/lib/capabilities/templates/types/
├── types.md
├── kind.ts                         TemplateKind
├── variable.ts                     TemplateVariable
├── spreadsheet.ts                  TemplateCell, SpreadsheetTemplate
└── body.ts                         TemplateBody
```

Two tables in one capability, so `schema/` is a directory — see
[the convention](README.md#schemas-are-a-directory-one-file-per-table).

The two prompt-block fields above are written into
[`$content/types/block.ts`](content.md#the-six-variants) rather than here.

**Imports it does not define:** [`$shared/types/actor`](shared.md#actor),
[`$shared/types/resource-selection`](resource-sets.md#the-selection),
[`$spreadsheets/types/cell`](spreadsheets.md#what-a-cell-is), and the two
resource bodies named in [resources](resources.md).

## Related

[all tables](README.md) · [resource sets](resource-sets.md) ·
[resources](resources.md)
