# Stage 0 — Foundation changes

The vocabulary every table is written in: five type groups and one capability,
none of which declares storage of its own. This is the only point in the review
where the model can be argued about without a table in the way.

**This document is the target design, not what is on
`convex-implementation`.** Where the two differ, the difference is marked and
explained. `main` should implement what is written here; the branch is the
reference for everything unchanged.

## Why these are Convex validators

The [data models](../../data-models/) show TypeScript interfaces — that is the
thinking. The code shows `v.object` / `v.union` validators, because that is what
Convex actually enforces at the door, and the TypeScript type is generated *from*
the validator by `Infer<typeof …>`. Reviewing the interface alone would review
something no request ever passes through.

Both forms are given below: the interface first because it reads better, the
validator where its shape carries a decision the interface cannot show.

They diverge in exactly three places — `FormulaValue`, `TableCell`, and
`ContentBlock` — and each divergence is a compromise worth knowing about. A
Convex validator is a **value**, not a type, so it cannot refer to itself. Where
a shape is genuinely recursive, the validator gives up and the TypeScript type
stays honest.

`◆` marks a reference held as a plain string because the table it names arrives
in a later stage. Each is one line that changes at merge and changes back when
the table lands.

## Changes from what was built

| # | Change | Why |
| --- | --- | --- |
| 1 | **The `messages` table is removed.** Owners hold `messages: Message[]` | A conversation is never read outside its consumer, and is most of what the consumer is |
| 2 | **`ThreadRef` is removed** | The owner holds the message; the link stops needing to exist |
| 3 | **`ToolCall` is removed entirely** | A client concern. The client holds a call's output in memory while the thread is open; on reload only what the message stored survives |
| 4 | **`MessageSource` → `ResourceRef[]`**, without `excerpt` or `title` | Everything citable is already a resource, and the ref is enough to find it |
| 5 | **`at` → `sentAt`**, and ordering is array position | An array is already ordered; a timestamp is for display only |
| 6 | **`labels?: string[]` added** to a message | Open — see the decision |
| 7 | **`externalFiles.storageId` becomes optional**, and a capture records its outcome | A link that failed to fetch is still a link worth keeping |

---

# shared/types — cross-cutting vocabulary

Six types belonging to no single table. They live here because putting `Actor` in
`access` would mean every table importing the authorization capability for a
reason unrelated to authorization.

## Actor — 78 imports

Who did something. Embedded in most tables as `createdBy`, `updatedBy`, `actor`,
`author`, or `origin`.

```ts
type Actor =
  | { kind: "user";       userId: Id<"users"> }
  | { kind: "agent";      taskId: Id<"agentTasks"> }        // ◆
  | { kind: "automation"; automationId: string }
  | { kind: "connector";  connectorId: string }
  | { kind: "system" };                                     // no id: nothing to look up
```

`◆` `taskId` is a plain string until agent tasks land. `automationId` and
`connectorId` stay strings — those tables are deferred and not built.

**Decisions baked in**

- **An agent actor points at the task, not the persona.** The task already
  carries `personaId`, so storing both lets them disagree — and the task is the
  more specific truth about what acted.
- **Reference, never label.** `ActorLabel` is separate and stored only in
  `activity`. A display string on every change set would be duplicated thousands
  of times per document and go stale on a rename.
- **Undo scopes on this field** — `kind === "user"` and a matching id. That is
  the field's purpose, not a filter added later.

**Decide**

- Is the five-kind set closed? A sixth kind touches 78 files.
- `automationId` and `connectorId` are unvalidated strings and stay that way
  unless their tables are built. Remove those two kinds until then, or accept it?

## Mention — 8 imports

`Actor`'s mirror image: who a remark is addressed to.

```ts
type Mention =
  | { kind: "user";    userId: Id<"users"> }
  | { kind: "persona"; personaId: Id<"personas"> }          // ◆
  | { kind: "task";    taskId: Id<"agentTasks"> };          // ◆
```

**Decisions baked in**

- **You mention a persona; the thing that acts is a task.** A persona is a
  durable identity you talk to, a task is one run of it. The addressable set and
  the acting set overlap without matching.
- **No `automation`, `connector`, or `system`.** They are things that happen, not
  things you talk to.

**Decide** — two overlapping unions now exist. Confirm the asymmetry is worth the
duplication.

## ResourceKind and ResourceRef — 11 imports

What a project holds and works over: the kinds a scope can select and retrieval
can index.

```ts
type ResourceKind =
  | "document" | "slides" | "spreadsheet"
  | "externalFile" | "finding" | "connector" | "template";

interface ResourceRef {
  kind: ResourceKind;
  id: string;          // permanently a string — seven kinds answer to it
}
```

**Decisions baked in**

- **A finding is a resource.** Durable content with a body, cited, indexed —
  "answer from our findings only" is an obvious thing to scope to.
- **A question and a hypothesis are not.** They are the project's open threads
  rather than its material; retrieving over a question returns the asking rather
  than an answer.
- **The kind is stored beside the id** so a set resolves without probing every
  table to discover what each id is.

**Decide**

- `connector` resolves to *the files it brought in*, never the credential record.
  Is a kind that expands to a different kind sound?
- `connector` and `template` are resource kinds that are **not** lattice sources.
  The invariant runs one way only — intended, or an omission?

## SetExpression — 18 imports

How a group of resources is named: retrieval scope, a persona's material, a
prompt block's inputs.

```ts
type SetExpression =
  | { op: "project" }
  | { op: "kind";       kind: ResourceKind }
  | { op: "resources";  refs: ResourceRef[] }
  | { op: "set";        setId: Id<"resourceSets"> }
  | { op: "union";      of: SetExpression[] }
  | { op: "difference"; from: SetExpression; remove: SetExpression };
```

The validator cannot say this, because it would have to refer to itself. It
unrolls the nesting four times instead, with `{ op: "set" }` as what goes deeper.

**Decisions baked in**

- **An expression, resolved when used — never an id list.** `{op:"project"}`
  includes a document created tomorrow; a list captured today would silently mean
  "the project as it was" and decay from the moment it was saved.
- **No intersection primitive.** Expressible as `difference(A, difference(A, B))`;
  adding it would be a third way to write what two operators cover.
- **It lives in `shared`, not `resourceSets`** — a persona's scope, a prompt
  block's, and a derived output's inputs are the same question, and whichever
  table was built first would be an odd place for the others to import from.

**Decide** — four levels, then you must name a set. The justification is "an
expression worth nesting deeper is worth naming." Is that a limit anyone hits,
and is the failure legible when they do?

## PageSetup — 4 imports

```ts
type PaperSize =
  | "letter" | "legal" | "tabloid" | "a3" | "a4" | "a5"
  | { width: number; height: number };

interface PageSetup {
  paper: PaperSize;
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
}
```

**Decisions baked in**

- **Every dimension in points, 1/72 inch.** A pixel has no physical size, and
  picking millimetres or inches makes the other a conversion at every use.
- **A named size is stored as its name.** A4 resolved to 595.28 × 841.89 is
  indistinguishable from a custom size that matches, and no picker can then show
  the right entry.
- **Orientation is separate from size.** Landscape A4 is still A4 — same sheet,
  same tray.
- **Margins are the content boundary**; a header and footer sit outside them,
  measured from the page edge.

## StyleSet — 4 imports

```ts
interface TextStyle {
  name: string;              // what a person picks from a menu
  fontFamily?: string;
  fontSize?: number;         // points
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  lineHeight?: number;       // multiplier
  spaceBefore?: number;      // points
  spaceAfter?: number;       // points
  align?: "start" | "center" | "end" | "justify";
  indent?: number;           // points
}

interface StyleSet {
  styles: Record<string, TextStyle>;
  defaultKey: string;        // required
}
```

**Decisions baked in**

- **A block carries a style *key*, not a copy of the formatting** — which is what
  makes editing "Heading 1" restyle every heading at once.
- **Key and display name are separate**, so renaming a style is one field rather
  than a rewrite of every block referencing it.
- **`defaultKey` is required**: a resource with no default renders unstyled text
  differently depending on which renderer is asked.
- **It lives inside the resource body**, so restyling is an ordinary change set
  and an undo reaches it.

---

# content/types — the one content primitive

Anything a person authors or an agent produces is a list of these, embedded in
whatever owns them.

## TextAtom and Mark

The two things inside a text block. Everything about merge granularity comes from
these carrying ids.

```ts
type TextAtom =
  | { id: string; kind: "literal"; text: string }
  | { id: string; kind: "formula"; expression: string; resolved: string;
      state: "fresh" | "stale" | "computing" | "error"; error?: string };

interface Mark {
  id: string;
  from: number;              // UTF-16 offset into `display`, NOT into `atoms`
  to: number;
  style?: ("bold" | "italic" | "underline" | "strikethrough" | "code")[];
  link?: string;
  color?: string;
}
```

**Decisions baked in**

- **Marks index `display`, not `atoms` — the load-bearing decision in the whole
  content model.** Someone who bolds `$4.2M` bolded five characters of what they
  saw, not the nineteen characters of `{{SUM(Sales!B:B)}}` behind them. Marks
  anchored to raw atoms could not express "bold the result", because the result
  is not in the raw at all.
- **A formula atom carries its own `resolved` and `state`**, so a block is still
  readable while a formula is stale.
- **Marks carry ids** so a change targets one mark rather than replacing the
  array — two people bolding different words in one paragraph then merge.
- **Atom ids give the finest merge granularity in the model.** Two people editing
  either side of a formula in one sentence touch different atoms and both survive.

## ContentBlock — 35 imports

Six variants, discriminated on `type`. No owner accepts all six — a spreadsheet
cell takes text and formula, a comment takes text and image — and the owner
enforces its own set.

```ts
interface TextBlock {
  id: string;
  type: "text";
  variant: "paragraph" | "heading" | "list" | "quote" | "code";
  level?: number;
  listStyle?: "bullet" | "ordered" | "todo";
  checked?: boolean;
  language?: string;
  style?: string;            // key into the resource's StyleSet
  atoms: TextAtom[];         // raw — what was authored
  display: string;           // resolved — what is shown
  marks: Mark[];
  resolvedAt?: number;
  format?: BlockFormat;
}

interface FormulaBlock {
  id: string; type: "formula";
  expression: string; display: string; value: FormulaValue;
  state: "fresh" | "stale" | "computing" | "error";
  error?: string; resolvedAt?: number; format?: BlockFormat;
}

interface ImageBlock {
  id: string; type: "image";
  source: { kind: "file"; fileId: Id<"externalFiles"> }      // ◆
        | { kind: "url";  url: string };
  display?: { fileId: Id<"externalFiles">; width: number; height: number };  // ◆
  alt: string;               // REQUIRED
  caption?: TextBlock;
  crop?: { x: number; y: number; width: number; height: number };
  format?: BlockFormat;
}

interface TableBlock {
  id: string; type: "table";
  rows: { id: string; cells: TableCell[] }[];
  headerRows: number;
  columnWidths?: number[];
  format?: BlockFormat;
}

interface TableCell {
  id: string;
  blocks: ContentBlock[];    // validator says v.array(v.any()) — recursion
  rowSpan?: number; columnSpan?: number; format?: BlockFormat;
}

interface EmbedBlock {
  id: string; type: "embed";
  url: string;
  presentation: "card" | "inline" | "iframe";
  title?: string; description?: string;
  thumbnail?: { fileId: Id<"externalFiles">; width: number; height: number };
  fetchedAt?: number; format?: BlockFormat;
}

interface PromptBlock {
  id: string; type: "prompt";
  derivedOutputId: Id<"derivedOutputs">;                     // ◆
  atoms: TextAtom[]; display: string; marks: Mark[];         // identical to TextBlock
  scope?: SetExpression;
  state: "fresh" | "stale" | "generating" | "error";
  error?: string; refreshedAt?: number; format?: BlockFormat;
}
```

**Where the validator and the type differ** — `TableCell.blocks` is
`v.array(v.any())` in the validator; the type says `ContentBlock[]`. The
recursion is real and unstatable.

**Decisions baked in**

- <a id="nonewline"></a>**A block holds no newlines.** Enter ends a block and
  starts another. That keeps one block one styleable, measurable, placeable
  thing — and makes mark offsets tractable, since there is one display string and
  one coordinate space.
- **Ids go all the way down, from one flat space per resource.** Flat so a block
  moved between rows keeps its identity; the move and an edit to its text never
  have to agree about where it lives.
- **Text is one variant with five presentations**, not five types. A paragraph
  becoming a heading is a `variant` change, not a rewrite.
- **A formula *atom* and a formula *block* are kept apart.** A block has a typed
  value other formulas depend on and either computes or errors; an atom produces
  a string span and the sentence around it still renders when it fails.
- **A prompt block *is* a text block** with a derived output behind it. Splitting
  it out would mean a second text editor with its own offsets to reconcile
  forever. The prompt itself lives on the output — a copy would be two prompts
  that can disagree.
- **`alt` is required.** An image without it is a hole in every non-visual
  consumer: search, the lattice, screen readers, and any agent reading the
  document.
- **A divider and a page break are *not* blocks.** They hold no content, take no
  marks, and cannot be searched — they are row kinds instead. Content and
  structure split there.

**Decide**

- **The union is a type, but two members name late tables.** Discuss it whole
  here; merge it in three pieces.
- **`TableCell.blocks` is `v.any()`.** The recursion is bounded by the owner
  instead — no surface accepting a table accepts one nested in a cell. Is
  "bounded by convention" enough, or should a cell take a narrower explicit union?

## FormulaValue and DateValue — 11 imports

```ts
interface DateValue {
  calendar: "gregorian";
  year: number; month: number; day: number;
  hour?: number; minute?: number; second?: number; millisecond?: number;
  timeZone?: string;
  utc: number;               // derived from the components; the fast path
}

interface FormulaColumn { name?: string; valueFormat?: string }

type FormulaValue =
  | { kind: "empty" }        // not zero, not "", not false
  | { kind: "number";  value: number }
  | { kind: "text";    value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "date";    value: DateValue }
  | { kind: "table";   columns: FormulaColumn[]; rows: FormulaValue[][] };
```

**Where the validator and the type differ** — a cell is `v.any()` in the
validator. Only the `table` member is written twice.

**Decisions baked in**

- **`empty` is not zero, an empty string, or false.** A reference to a blank cell
  is none of those, and collapsing it is how a sum quietly counts a gap as a value.
- **There is no `error` kind.** A failure is a property of the computation, so it
  lives in the block's `state` — otherwise every consumer of a value must
  re-check whether it really is one.
- **A date is a record, not a number.** The parts are separately meaningful, and
  a date with no time is genuinely different from one at midnight.
- **`utc` is derived and stored anyway**, rewritten whenever a component changes
  and never edited alone.
- **Columns are typed independently**, because a date column and a currency
  column render differently inside one result.

**Decide** — the recursion answer is reused in three places. It rejected the
`settings` precedent of JSON-encoding the whole value, because the outer `kind`
discriminant *is* read server-side and JSON text protects nothing that has to be
read. Accepted cost: a malformed *nested* cell is storable, so a renderer of one
must be defensive.

## BlockFormat — 2 imports

```ts
interface BlockFormat {
  align?: "start" | "center" | "end" | "justify";
  verticalAlign?: "top" | "middle" | "bottom";
  background?: string;
  border?: { color: string; width: number; style: "solid" | "dashed" | "dotted" };
  padding?: { x?: number; y?: number };
  valueFormat?: string;
}
```

**Decisions baked in**

- **On the block, not the container.** A container would otherwise have to know
  how many blocks it holds and which one is being styled.
- **Both axes.** Vertical alignment means something only when a block sits in a
  box taller than itself — the spreadsheet cell and the slide element, the cases
  that made blocks worth sharing.
- **`valueFormat` is on the format, not the value**, so the same date renders two
  ways in two places without being stored twice.

---

# Message — decorated content blocks

A message is blocks plus the little that belongs to the grouping rather than to
any block in it: who said it, when, and which side of the exchange it is on.

**It cannot just be a block.** A message is plural in blocks — a response with a
paragraph, a table, and a chart is three, and [a block holds no
newlines](#nonewline), so even two paragraphs are two. And a block has no field
for attribution or time.

A document is not a flat block list either. It is `DocumentRow[]`, and a row
holds `blocks` plus the metadata the row owns. **A message is the same shape with
a different decoration** — which is why it belongs beside `ContentBlock` in the
foundation, in a capability with no `schema.ts`, exactly as `content` is.

```ts
interface Message {
  id: string;                // local to the thread, like a row id
  role: "prompt" | "response";
  author?: Actor;            // absent = the thread's own responder
  sentAt: number;            // WHEN, not order
  blocks: ContentBlock[];
  mentions?: Mention[];
  sources?: ResourceRef[];
  labels?: string[];         // open — see Decide
  state: "streaming" | "complete" | "error";
  error?: string;
}
```

**Ordering is array position, not `sentAt`.** The owner holds
`messages: Message[]` and appends, so order is the array's. `sentAt` exists only
to display a time, and nothing reads it to sequence anything — which is also why
no `previousMessageId` is needed. A linked list is what you reach for when rows
sit unordered in a table; an array is already ordered.

**Gone with the table** — `thread: ThreadRef`, `projectId`, `Id<"messages">`, and
the `by_thread` index. The link stops needing to exist.

**Gone entirely: `toolCalls`.** A client concern, not a stored one. The client
holds a call's output in memory while the thread is open; on reload only what the
message stored survives, which may be an ordinary text block naming the call and
its inputs. Nothing here models it, and nothing should — a block variant for tool
calls would push the problem somewhere else and give it a schema.

**Decisions baked in**

- **`role` is not `user | assistant`.** A thread is a room, not a two-party
  exchange — with three people and an agent in it, "user" would be four different
  actors wearing one label. Identity is `author`; role says which side of the
  exchange a turn is on.
- **`author` absent on a response means the obvious responder** — a persona
  answering in its own chat, a task reporting in its own thread. Presence always
  names someone else. A prompt has no obvious asker, so an unauthored one is
  rejected, and that rule is a function rather than a validator because a
  validator cannot express a constraint between two fields.
- **`state` is derived from `error`, never supplied.** Two fields saying whether
  the turn worked can disagree; one cannot. Blocks are carried either way,
  because a turn that failed halfway still said something.
- **Append-only.** Changing a conversation is branching, not editing.
- **Messages are not lattice sources.** A conversation is working material; a
  turn worth keeping is promoted to a `finding`, and that promotion is the
  editorial act worth indexing.
- **Nothing here says how a conversation is grouped or paged.** That belongs to
  the research thread, persona chat, or agent task that owns it.

**Decide**

- **`labels`** — optional tags so a client can mark a turn as a decision, a
  question, a summary, without a new field per idea. Cheap and open-ended, which
  is both the argument for and against. In or out?
- **Consecutive turns from one author.** They share role and author and differ
  only in time, so they could merge into one message with several blocks.
  Cheaper, and it is how chat reads anyway — but a message is the unit you branch
  from, so merging changes what a branch point is. Deferred.

## sources

Three variants collapse to one, because everything a message can cite is already
a resource, and the ref is enough to find it.

```ts
sources?: ResourceRef[]      // { kind: ResourceKind, id: string }
```

**No `excerpt`, no `title`.** A message is working material. Where an excerpt has
to survive — a finding's citation — it is copied and dated at promotion, because
a finding's citations must outlive the thread.

**A web link is captured, always.** `FileOrigin` already has a `capture` variant
built for exactly this: a page read while investigating becomes an `externalFile`
so the bytes actually read are kept. Pages change and disappear; a citation wants
the copy, not just the link.

### Consequence: a capture that failed is still a capture

`externalFiles.storageId` is currently **required**, so a fetch that fails cannot
produce a row at all — and the link is then lost entirely. That is wrong: the
link is there regardless of whether what it returned was any use.

```ts
// externalFiles.storageId becomes optional
storageId?: Id<"_storage">;      // absent = nothing was retrieved

// and the capture origin records its outcome
{ kind: "capture"; url: string; capturedAt: number;
  ok: boolean; error?: string }
```

A row with a `capture` origin and no `storageId` is a link we tried and failed to
fetch. It still resolves as a source, it still says where it pointed and when,
and it says plainly that there are no bytes behind it.

**Decide** — this makes `storageId` optional for *every* file kind, not just
captures. The alternative is a separate table for attempted captures, which is
worse: two places to look for one link.

---

# revisions/types — the edit vocabulary

Five ops over a path. These ship with their tables, but they are foundation:
everything that edits a body is written in them.

```ts
type ResourceType = "document" | "slides" | "spreadsheet";
type ResourceKey  = { resourceType: ResourceType; resourceId: string };

type OpTarget =
  | "row" | "block" | "atom" | "mark"          // content anywhere
  | "slide" | "element" | "section"            // slides
  | "sheet" | "cell" | "merge" | "chart"       // spreadsheet
  | "field";                                   // page setup, styles, theme

type Op =
  | { op: "set";    target: OpTarget; path: string; value: unknown; was: unknown }
  | { op: "insert"; target: OpTarget; path: string; after: string | null;
      values: unknown[] }
  | { op: "remove"; target: OpTarget; path: string; ids: string[];
      after: string | null; values: unknown[] }
  | { op: "move";   target: OpTarget; path: string; id: string;
      after: string | null; wasAfter: string | null }
  | { op: "text";   target: "atom"; path: string;   // ← the ONLY pairing enforced
      at: number; insert: string; remove: string };
```

**Decisions baked in**

- **Five untyped ops over a path, not a typed vocabulary.** `rowInsert`,
  `blockSet`, `themeSet` would encode in the op name what the path already
  encodes — and every new field in any body would need a new op type.
- **Every op is closed under inversion**, which is what the extra payloads buy:
  `was` reverses a set, `values` and `after` reverse a remove, `wasAfter`
  reverses a move. An undo is an ordinary change set, not a rewind.
- **`text` targets literal atoms only.** A formula's expression is replaced with
  `set`, which keeps the one in-place string edit in the system to one kind of
  string — the precondition that makes offset shifting safe to attempt at all.
- **`target` exists so the conflict ladder can pre-filter** without resolving
  paths against a body: a row insert cannot collide with a mark edit, and knowing
  that cheaply is what makes the cheap checks cheap.

**Decide** — the legal `(op, target)` pairings are **not enforced**. The model
states a twelve-by-five table of legal combinations; the validator states one.
The rest is convention in `types.md`. A validator could hold it by writing the
union out per target: twelve members instead of five.

---

# formula — the one capability with no table

It has a public door, an `api/`, errors, and no `schema.ts` at all.

```text
formula/
├── errors.ts
├── types/expression.ts       the parsed form
├── types/evaluation.ts       result + context
└── api/evaluate/
    ├── evaluate.ts           the public function
    ├── parse.ts
    └── reduce/{reduce,arithmetic,builtins}.ts
```

**Decisions baked in**

- **Stateless — an expression is text on the block that holds it.** Nothing to
  persist beyond the expression and its resolved value, both of which live on the
  block.
- **Formula depends on the name manager, never the reverse.** It resolves any
  bare name that is not a built-in by asking; the name manager evaluates nothing.
  That is what keeps the two from depending on each other in a circle.
- **No calculation graph is stored.** Dependency order is derived from the
  formulas at load — persisting it would mean maintaining a second representation
  that can disagree with the first.

---

# What the validators do not enforce

Five invariants the model states that no schema check catches. Each is upheld by
code somewhere, and each is a place a future change breaks something silently.

| Invariant | Upheld by | If it breaks |
| --- | --- | --- |
| `display` is the atoms' text in order | `applyOps` | Marks index a string that no longer matches its atoms — silently wrong text runs |
| Marks are UTF-16 offsets into `display` | `applyOps` and `shift` | Formatting drifts onto the wrong words, no error raised |
| Legal `(op, target)` pairings | Convention only | A nonsensical op stores fine and fails when something applies it |
| A prompt names its author | `messageAuthor()` | A question from nobody, with no way to attribute or reply |
| Ids are unique within a resource | Whoever mints them | A path resolves to two things; the conflict ladder's identity check stops meaning anything |

## Related

[merge order](../../storage/merge-order.md) ·
[data models](../../data-models/) ·
[decisions](../decisions/2026-08-16-convex-implementation.md)
