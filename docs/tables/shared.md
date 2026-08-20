# Shared types

No tables. This is `$shared/types/` — the types more than one capability holds,
and the three that no single table owns.

Every other group's document lists these under "imports it does not define". This
is where they are defined.

---

## `Actor`

`app/src/lib/capabilities/shared/types/actor.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * Who did something. One type for every table that attributes anything.
 *
 * **The agent variant points at its task, not its persona.** The task already
 * carries `personaId`, so storing both would let them disagree, and the task is
 * the more specific truth about what acted. The same reasoning puts `connection`
 * here rather than `connector`: a connection reaches its connector, and a
 * connector cannot reach a file.
 *
 * **A persona replying in its own thread is not an actor here.** `Message.author`
 * is optional, and absent on a response means the thread's own responder — so
 * attributing a reply never requires inventing a unit of work nobody asked for.
 *
 * `system` carries no id because there is nothing to look up.
 *
 * **There is no `automation` variant.** Its table does not exist, and a variant
 * holding an id nothing can resolve is worse than an honest absence. Adding a
 * union member later is a widening change — every existing row still validates —
 * so it costs nothing to wait for the table.
 */
export const actorValidator = v.union(
  v.object({ kind: v.literal("user"), userId: v.id("users") }),
  v.object({ kind: v.literal("agent"), taskId: v.id("agentTasks") }),
  v.object({ kind: v.literal("connection"), connectionId: v.id("connections") }),
  v.object({ kind: v.literal("system") })
);

export type Actor = Infer<typeof actorValidator>;
```

Per-variant field names rather than a uniform `id`, so each one is a real
`v.id(...)` against the table it names — Convex rejects an id belonging to the
wrong table at the door, and `db.get` is typed without a cast. Reading the field
requires knowing `kind`, which every consumer has already branched on.

---

## `PageSetup`

`app/src/lib/capabilities/shared/types/page-setup.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * A name or explicit dimensions.
 *
 * **A named size is stored as its name**, never resolved to numbers: A4 resolved
 * to 595.28 × 841.89 is indistinguishable from a custom size that happens to
 * match, and no paper picker can then show the right entry.
 */
export const paperSizeValidator = v.union(
  v.literal("letter"),
  v.literal("legal"),
  v.literal("tabloid"),
  v.literal("a3"),
  v.literal("a4"),
  v.literal("a5"),
  v.object({ width: v.number(), height: v.number() })
);

export type PaperSize = Infer<typeof paperSizeValidator>;

/**
 * Physical page dimensions, shared by all three general resources: a document's
 * page, a deck's handout, a sheet's print setup.
 *
 * **Every dimension is in points — 1/72 inch — never pixels.** A pixel has no
 * physical size, and these numbers describe something that will exist on paper.
 * The screen renderer converts at whatever zoom it shows, one-directionally.
 *
 * `orientation` is separate from `paper` rather than a swapped width and height,
 * because landscape A4 is still A4: same sheet, same tray.
 */
export const pageSetupValidator = v.object({
  paper: paperSizeValidator,
  orientation: v.union(v.literal("portrait"), v.literal("landscape")),
  /** The content boundary. A header and footer sit outside it, from the page edge. */
  margins: v.object({
    top: v.number(),
    right: v.number(),
    bottom: v.number(),
    left: v.number()
  })
});

export type PageSetup = Infer<typeof pageSetupValidator>;
```

---

## `StyleSet`

`app/src/lib/capabilities/shared/types/style-set.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * One named style. `name` is what a person picks from a menu; the key it sits
 * under is what blocks reference, so renaming a style is an edit to one field
 * rather than a rewrite of every block using it.
 *
 * Sizes and spacing are points; `lineHeight` is a multiplier.
 */
export const textStyleValidator = v.object({
  name: v.string(),
  fontFamily: v.optional(v.string()),
  fontSize: v.optional(v.number()),
  fontWeight: v.optional(v.number()),
  italic: v.optional(v.boolean()),
  underline: v.optional(v.boolean()),
  color: v.optional(v.string()),
  lineHeight: v.optional(v.number()),
  spaceBefore: v.optional(v.number()),
  spaceAfter: v.optional(v.number()),
  align: v.optional(
    v.union(v.literal("start"), v.literal("center"), v.literal("end"), v.literal("justify"))
  ),
  indent: v.optional(v.number())
});

export type TextStyle = Infer<typeof textStyleValidator>;

/**
 * A resource's named styles. A block carries a key into this rather than a copy
 * of the formatting, which is what makes editing "Heading 1" restyle every
 * heading at once.
 *
 * **It lives inside the resource's body**, so restyling is an ordinary change
 * set and an undo reaches it — and so a document cannot change appearance
 * because something outside it was edited.
 *
 * `defaultKey` is required: a resource with no default renders unstyled text
 * differently depending on which renderer is asked.
 */
export const styleSetValidator = v.object({
  styles: v.record(v.string(), textStyleValidator),
  defaultKey: v.string()
});

export type StyleSet = Infer<typeof styleSetValidator>;
```

---

## The whole directory

Three more shared types are defined in the document of the group that first
needs them, because each is inseparable from the design that produced it.

| File | Types | Defined in |
| --- | --- | --- |
| `actor.ts` | `Actor` | here |
| `page-setup.ts` | `PaperSize` `PageSetup` | here |
| `style-set.ts` | `TextStyle` `StyleSet` | here |
| `resource.ts` | `ResourceKind` `ResourceRef` | [resource sets](resource-sets.md#the-vocabulary) |
| `resource-selection.ts` | `SetTerm` `ResourceSelection` `PortableSelection` | [resource sets](resource-sets.md#the-selection) |
| `file-subkind.ts` | `FileSubkind` | [connections](connections.md#filesubkind) |

**`Mention` is not here.** In the text a mention is a `link` mark on a span; the
flattened list beside it is held by one table, so the type lives with
[`comments`](collaboration.md#comments).

**`Message` and `BranchPoint` are not here.** Both were shared while three
tables stored conversations; [`threads`](threads.md) now stores all of them, so
each type lives with the one table that holds it.

---

## Files

```text
app/src/lib/capabilities/shared/
├── overview.md
└── types/
    ├── types.md
    ├── actor.ts
    ├── page-setup.ts
    ├── style-set.ts
    ├── resource.ts
    ├── resource-selection.ts
    └── file-subkind.ts
```

`shared` declares no tables, so it has no `schema.ts` and appears in no schema
fragment.

## Related

[all tables](README.md) · [content](content.md)
