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

**Every id is a plain `string`, not `Id<"table">`.** Tables land in stages, and
typing an id against a table that does not exist yet means loosening it and
re-tightening it later — churn across dozens of files for a check that only ever
held inside one deployment anyway. Ids can be tightened in a single later pass if
it is ever worth it.

## Changes from what was built

| # | Change | Why |
| --- | --- | --- |
| 1 | **The `messages` table is removed.** Owners hold `messages: Message[]` | A conversation is never read outside its consumer, and is most of what the consumer is |
| 2 | **`ThreadRef` is removed** | The owner holds the message; the link stops needing to exist |
| 3 | **`ToolCall` is removed entirely** | A client concern. The client holds a call's output in memory while the thread is open; on reload only what the message stored survives |
| 4 | **`sources` → `attachments`**, a two-variant union, no `excerpt` or `title` | A resource ref finds the thing; a link records only where it pointed and whether it worked |
| 5 | **`at` → `sentAt`**, and ordering is array position | An array is already ordered; a timestamp is for display only |
| 6 | **`labels?: string[]` added** to a message | Cheap, open-ended, and lets a client mark a turn without a field per idea |
| 7 | **`Mention` moves into `Mark`** as `mention?` | A mention is a span of typed text, so it belongs in the text — not in a field beside it |
| 8 | **`SetExpression` → `ResourceSetExpression`**, flattened to `include` / `exclude` | Any tree of unions and differences normalizes to two flat lists; the depth-4 unrolling disappears |
| 9 | **`ResourceKind` becomes an open string** with `::` subkinds | A connector is a provider and a version; a closed union cannot grow with integrations |
| 10 | **`Actor` drops `automation` and `connector`** | An unvalidated string nothing checks is worse than an honest absence |
| 11 | **`FormulaValue` gains `reference`; `list`, `record`, and `range` all stay `table`** | A value is a result, not a query — liveness belongs to the formula that recomputes |
| 12 | **`TextStyle` gains `bold` and `background`** | Bold was the one common style you could not set the way you set italic |
| 13 | **Every id is a plain `string`** | Tables land in stages; typing them means loosening and re-tightening across dozens of files |
| 14 | **`Actor` kinds become `user` / `task` / `persona` / `system`**, uniform `{kind, id}` | A persona answering in its own chat is not a task, and inventing one to attribute a reply invents a unit of work |
| 15 | **The extracted `mentions[]` array is dropped** | Mentions live in marks now; the array was a denormalization that could drift |
| 16 | **Sheet cells get ids** | Removes the keyed-collection special case in `touched` rather than handling it |

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
  | { kind: "user";    id: string }
  | { kind: "task";    id: string }
  | { kind: "persona"; id: string }
  | { kind: "system" };              // no id: nothing to look up
```

**Four kinds, uniform `{ kind, id }`.** Per-variant names — `userId`, `taskId` —
made the same shape read four ways for no gain. This matches `ResourceRef`, so
one accessor works on both.

**`agent` is now `task`, and `persona` joins it.** The old union had one agent
kind pointing at a task, on the reasoning that a run is what acts. That is right
for tracked work and wrong for a chat: **a persona answering in its own thread is
not a task**, and forcing one into existence to attribute a reply would invent a
unit of work nobody asked for. So a task acts when work is tracked, and a persona
acts when it is talking.

**`automation` and `connector` are gone.** Their tables do not exist, and an
unvalidated string nothing checks is worse than an honest absence. They return
with their tables, if they need to at all.

**Actor kinds have no subkinds.** They are a closed set of four, unlike
[resource kinds](#resourcekind-and-resourceref), which grow with integrations.
Nothing here prefix-matches.

**Decisions baked in**

- **A task actor points at the run, not the persona behind it.** The task already
  carries `personaId`, so storing both lets them disagree — and the run is the
  more specific truth about what acted.
- **Reference, never label.** `ActorLabel` is separate and stored only in
  `activity`. A display string on every change set would be duplicated thousands
  of times per document and go stale on a rename.
- **Undo scopes on this field** — `kind === "user"` and a matching id. That is
  the field's purpose, not a filter added later.

## Mention — and where it actually belongs

```ts
type Mention =
  | { kind: "user";    id: string }
  | { kind: "persona"; id: string }
  | { kind: "task";    id: string };
```

Same uniform `{ kind, id }` as `Actor`, and now the same three addressable kinds
minus `system` — because you do not talk to the system.

**The type is right; its home was wrong.** It was a `mentions?: Mention[]` field
sitting beside `blocks` — which meant the content had no way to say *where* in a
sentence the mention appeared. A mention is a span of text a person typed, so it
belongs in the text.

**A mention is a mark.** `Mark` already carries `link?: string` for exactly this
shape of thing — a range of `display` that points somewhere. A mention is the
same with a different target:

```ts
interface Mark {
  id: string; from: number; to: number;
  style?: (…)[];
  link?: string;
  mention?: Mention;         // ← this is where it lives
  color?: string;
}
```

That gets the behaviour right for free: the mark shifts when text before it is
edited, it survives a merge, and it renders inline where it was written.

**What `Mention` itself is for** is naming what the span resolves to, and that is
worth a type because the three targets behave differently — a user is notified, a
persona opens a chat, a task receives a steer.

**Decisions baked in**

- **Mentioning a persona and mentioning a task are different acts.** A persona is
  a durable identity — mentioning one starts or continues a chat with it. A task
  is one run, and mentioning it steers work already in progress.
- **No `system`.** It is a thing that happens, not a thing you talk to. That is
  the only difference from `Actor` now that both use the same three named kinds.

**The extracted `mentions[]` array is dropped.** Its only purpose was making
"everything mentioning me" an index rather than a scan, and it is a
denormalization that can disagree with the text it summarizes. The query is real
and can have the field back when something actually needs it.

## ResourceKind and ResourceRef — 11 imports

What a project holds and works over.

```ts
/** Open, not a closed union. Base kinds today: */
type ResourceKind = string;   // "document" | "slides" | "spreadsheet"
                              // "externalFile" | "finding"
                              // "connector" | "template" | …

interface ResourceRef {
  kind: ResourceKind;
  id: string;
}
```

**The kind is an open string, and subkinds use `::`.** A connector is a provider
and a version, not one thing — `connector::google-docs-v1`. A closed union cannot
express a provider space that grows.

**Matching is prefix matching.** A kind matches another when it is a prefix of
it, so `connector` matches `connector::google-docs-v1`, and
`connector::google-docs` matches every version of it. One selector covers a whole
provider without enumerating anything, and that is the entire reason the
delimiter exists rather than being decoration.

**Kind and id stay separate fields.** That is what makes the kind — and its
subkind — readable without parsing an id, which is the whole reason they were
split. A concatenated key would force every reader to split it back apart.

The cost is honest: an open string is not validated, so a typo in a kind is a
silent miss rather than a rejected write. A closed union would catch that and
would make every new connector a schema change. **The open space is the right
trade for a set of kinds that grows with integrations.**

**Decisions baked in**

- **A finding is a resource.** Durable content with a body, cited, indexed —
  "answer from our findings only" is an obvious thing to scope to.
- **A question and a hypothesis are not.** They are the project's open threads
  rather than its material; retrieving over a question returns the asking rather
  than an answer.
- **The kind is stored beside the id** so a set resolves without probing every
  table to discover what each id is.
- **Which kinds are lattice sources is not settled here** and does not need to
  be. A connector's material probably is; a template never is. That question
  belongs to retrieval, not to this type.

## ResourceSetExpression — 18 imports

How a group of resources is named: retrieval scope, a persona's material, a
prompt block's inputs. **Renamed from `SetExpression`** — "set" alone says
nothing about what is in it.

```ts
interface ResourceSetExpression {
  include: Selector[];
  exclude: Selector[];
}

type Selector =
  | { kind: "project" }
  | { kind: "resourceKind"; resourceKind: ResourceKind }
  | { kind: "resource";     ref: ResourceRef }
  | { kind: "set";          setId: string };
```

**No nesting, no recursion, no depth limit.** The previous design was a tree of
`union` and `difference` nodes unrolled four times, because a Convex validator
cannot refer to itself. That is gone: **any tree of unions and differences
normalizes to one flat include set and one flat exclude set.**

Unions merge into the include side. Differences merge into the exclude side.
Nesting deeper never produces anything the two lists cannot already say.

**Normalization, applied on write**

| Rule | Effect |
| --- | --- |
| `project` appears in `include` | Drop every other include — it already covers them |
| A `resourceKind` appears in a list | Drop `resource` selectors it prefix-matches from the same list |
| A selector appears in both lists | `exclude` wins; the include is dropped |
| Duplicate selectors | Collapse |

**An empty `include` resolves to nothing, not everything.** Everything is
`{ include: [project] }`, said out loud. That matters because an empty list is
what an unfinished form produces, and a default that silently means "the whole
project" is how a scope somebody meant to narrow leaks the lot.

So `difference(project, kind("document"))` is stored as
`{ include: [project], exclude: [kind document] }`, and there is exactly one
representation of it. **A canonical form is what makes two sets comparable** —
under the old tree, the same set had many spellings and none of them could be
diffed.

**Decisions baked in**

- **An expression, resolved when used — never an id list.** `{kind:"project"}`
  includes a document created tomorrow; a list captured today would silently mean
  "the project as it was" and decay from the moment it was saved.
- **No intersection primitive.** `A ∩ B` is `A` minus everything not in `B`, and
  a third operator would be a second way to write what these two already cover.
- **`{kind:"set"}` is how one set builds on another.** It resolves at use time,
  so nesting happens during resolution rather than in the stored shape, and
  resolution must still detect cycles and fail naming them.
- **It lives in `shared`, not `resourceSets`** — a persona's scope, a prompt
  block's, and a derived output's inputs are the same question, and whichever
  table was built first would be an odd place for the others to import from.

**Deferred** — pinning a set to a moment in time. Resolution is always "as of
now", and a consumer that needs to remember what it actually saw records the
resolved refs itself. Revisit if something genuinely needs a frozen set rather
than a frozen answer.

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

**Headers, footers, page numbers, and a different first page are not here.** They
are `PageFurniture` on the document, because a deck's handout and a sheet's print
setup do not have them. `PageSetup` is only the physical page.

## StyleSet — 4 imports

```ts
interface TextStyle {
  name: string;              // what a person picks from a menu
  fontFamily?: string;
  fontSize?: number;         // points
  fontWeight?: number;
  bold?: boolean;            // ← added
  italic?: boolean;
  underline?: boolean;
  color?: string;
  background?: string;       // ← added
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

- **`bold` is a boolean beside `fontWeight`.** The weight is the precise control
  and the boolean is what a toolbar toggles; without it, bold was the one common
  style a person could not set the way they set italic and underline.
- **No `verticalAlign` here.** It is on `BlockFormat`, where it means something —
  a style applies to text, and vertical alignment is a property of the box the
  text sits in.
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
  mention?: Mention;         // ← a mention is a mark, see above
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
  source: { kind: "file"; fileId: string }
        | { kind: "url";  url: string };
  display?: { fileId: string; width: number; height: number };
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
  thumbnail?: { fileId: string; width: number; height: number };
  fetchedAt?: number; format?: BlockFormat;
}

interface PromptBlock {
  id: string; type: "prompt";
  derivedOutputId: string;
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
  | { kind: "number";    value: number }
  | { kind: "text";      value: string }
  | { kind: "boolean";   value: boolean }
  | { kind: "date";      value: DateValue }
  | { kind: "reference"; ref: string }                         // ← added
  | { kind: "table";     columns: FormulaColumn[]; rows: FormulaValue[][] };
```

**One kind added, and three deliberately not.**

- **`reference` is an id the renderer resolves.** Always a plain string. A
  friendlier notation — `sheets.Budget.B7`, `document.Memo.row.block` — is a
  later concern that resolves *to* one of these, not a second shape here.
- **`list` is not a kind.** A one-column table says it, and a separate kind would
  make every consumer check whether a table was really a list.
- **`record` is not a kind.** A record is a one-row table whose fields are its
  columns, which `table` already says.
- **`range` is not a kind**, and this is the one worth stating properly.

### Why a range is a table

A live range — sheet, columns, rows, values pulled on read — was tempting, and
what killed it is that **a value is a result, not a query.** Liveness belongs to
the formula, which re-evaluates; a value is what that evaluation produced. A
range that stayed live would be the only value kind that changed without anything
recomputing it.

It also removes the awkward case: multiplying `B2:D10` by two produces something
that is no longer those cells. As a range that needed a second "augmented" form.
As a table it is just a table.

The one thing a range had that a table does not is knowing *where* the values
came from. If that turns out to matter — highlighting the source cells,
re-resolving after an edit — it is an optional field on `table` rather than a
second kind.

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
  attachments?: Attachment[];
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

**Deferred** — merging consecutive turns from one author. They share role and
author and differ only in time, so they could collapse into one message with
several blocks. Cheaper, and it is how chat reads anyway — but a message is the
unit you branch from, so merging changes what a branch point is.

## attachments

What a turn pulled in. Two variants on one discriminant.

```ts
type Attachment =
  | ResourceRef                     // { kind: ResourceKind; id: string }
  | { kind: "link";
      url: string;
      triedAt: number;
      ok: boolean;
      fileId?: string;              // when the fetch produced something storable
      error?: string };             // when it did not, and we know why
```

`kind` discriminates across all eight values, because `"link"` is not one of the
seven `ResourceKind` literals. No nesting and one switch.

**Named `attachments`, not `sources`.** These are things pulled into a turn, and
a source is a narrower claim — it implies the turn drew a conclusion from it.

**No `excerpt`, no `title`.** The ref is enough to find the thing, and a message
is working material. Where an excerpt has to survive — a finding's citation — it
is copied and dated at promotion, because a finding's citations must outlive the
thread.

**A link is its own variant, not a file.** Some attachments are resources we
already hold. Some are a URL we tried to fetch, and whether that produced an
`externalFile` is a separate question from whether the link was attached: the
retrieval can fail, or return something not worth storing as a file. `fileId` is
present when it worked and absent when it did not.

That is deliberately all it records — where we pointed, when, whether it worked,
and why not. Anything more is storage for a question nobody has asked.

---

# revisions/types — the edit vocabulary

Five ops over a path. These ship with their tables, but they are foundation:
everything that edits a body is written in them.

```ts
type ResourceType = "document" | "slides" | "spreadsheet";
type ResourceKey  = { resourceType: ResourceType; resourceId: string };

type OpTarget =
  | "row" | "block" | "atom" | "mark"                  // content anywhere
  | "slide" | "element" | "section"                    // slides
  | "sheet" | "cell" | "range" | "mergedCells"         // spreadsheet
  | "chart"
  | "field";                                           // page setup, styles, theme

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
- **`merge` is now `mergedCells`.** Every other target is a noun naming a thing;
  `merge` read as the verb for the operation being performed on it.
- **`range` is a target**, because a path can address one — a formula's operands,
  a print area, a chart's data all name a range rather than a cell.
- **A chart takes no `move`.** It anchors to a cell with an offset and floats
  above the grid rather than sitting in an ordered list, so there is no `after`
  for it to move past. Repositioning a chart is a `set` on its anchor. Sheets are
  the same: `cell` takes no `insert` or `move`, because setting `B7` is how a
  cell comes into being.

**Still open** — the legal `(op, target)` pairings are **not enforced**. The model
states a twelve-by-five table of legal combinations; the validator states one.
The rest is convention in `types.md`. A validator could hold it by writing the
union out per target: twelve members instead of five. Settle it with the
operations review rather than here.

## Consequence: sheet cells get ids

**Every addressable thing inside a resource carries an id — with no exception for
a spreadsheet cell.** Cells were the one place the model used a key instead,
their identity being their A1 address.

That exception cost more than it saved. `touched` collects the deepest id each op
addresses, and a cell had none — so a row insert reported none of the cells it
created, `touched` came back short, and a concurrent write to one of them passed
the entire conflict ladder. The fix at the time was a special case for keyed
collections. **Giving cells ids removes the special case instead of handling it.**

```ts
interface SheetCell {
  id: string;                  // ← added; stable across a move
  blocks: ContentBlock[];
}

// the map stays keyed by address
cells: Record<string, SheetCell>   // "B7" -> cell
```

**The id is not the address**, and that is the point. The map key is the address
because a formula referencing `B7` must be one lookup, and `B7` is what a person
means when they point. The id is what survives the cell being moved somewhere
else with its content intact — which the address, by definition, cannot do.

### A cell exists when it has a value **or** a consumer

The obvious objection is that ids break sparseness: a formula over `B2:B10000`
cannot mint ten thousand ids for cells nobody has typed in.

It does not, because **sparse never meant "only cells with values."** It meant
"only cells that matter", and a cell being referenced is exactly what makes it
matter. So the rule is two-sided:

- a cell holding content exists — it is *producing* something
- a cell inside a referenced range exists — it is being *consumed*

`formula` asks the sheet for the ids covering a range; the sheet mints what it
does not already have and hands them back. An empty cell nobody references still
costs nothing, which is the property sparseness was protecting.

**A range is anchored by its corners, not enumerated.** `SUM(B2:B10)` stored as
nine ids would not grow when a row is inserted at B5 — the new cell is not among
the nine, and the sum silently excludes it. Stored as its corner cells, the range
means "everything between these, at their current addresses", which both expands
correctly and survives the corners moving.

This belongs to the spreadsheet table rather than to the foundation, but it is
recorded here because it is the op vocabulary that made it necessary.

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

## Open: formulas get ids, and stop being text on a block

Cells having ids makes a second thing possible. **A formula stores cell *ids*,
not addresses**, so when a cell moves the formula still points at the same value
and simply renders a different address.

That means a formula has the same raw/display split a text block has:

| | Holds | Example |
| --- | --- | --- |
| **canonical** | what is stored — cell ids | `=#c4x1 * 2` |
| **rendered** | what a person reads — resolved to addresses | `=B7 * 2` |
| **value** | what it evaluated to | `84` |

**A formula gets its own table**, and the things that use one hold a `formulaId`
rather than expression text.

Nothing about the block structure changes. There are still text atoms and formula
atoms; a formula atom simply holds a reference instead of a copy:

```ts
// before
{ id, kind: "formula", expression: string, resolved, state, error? }
// after
{ id, kind: "formula", formulaId: string,  resolved, state, error? }
```

`FormulaBlock` loses `expression` for the same reason — it asks the formula, which
is the only thing that can give an up-to-date rendering anyway.

**Formulas are never deduplicated.** Two cells holding `=A1*2` are two formulas
with two ids, because sharing one would mean editing either edits both.

**The `text`-op precondition still holds, and gets stronger.** A formula's
expression is not in any block's display string now, so there is nothing for a
`text` op to reach even by accident. Editing a formula is a `set` on the formula.

### A formula is immutable; editing one mints a new id

The resource's change log has to carry a formula edit, because that is where undo
looks and the edit is part of what the resource did. But a formula row is not in
the resource's body, so the obvious answer — a `formulaEdit` op the resource
knows how to perform — **breaks on replay.**

**Ops are pure functions on a body, and they run more than once.** Every read is
the leader snapshot plus the recent change sets applied over it, so an op that
reached outside the body to mutate a formula row would re-mutate it on every
read. An op that must run exactly once at append and do nothing thereafter is not
an op; it is a migration wearing one.

So the formula moves instead of the op getting clever:

```text
edit a formula  →  mint a NEW formula row with a new id
                →  the op is an ordinary `set` of the block's formulaId
                →  the old row is kept a while, then purged
```

**The `set` is pure.** Replaying it a thousand times sets the same id a thousand
times. Undo is `set` back to the previous id, which is already what `was` holds.
Nothing about the op vocabulary changes, and no special case enters the ladder.

**A move does not mint a version.** Because a formula stores cell ids rather than
addresses, a cell changing address changes only how the formula *renders* — its
canonical form is untouched, so no new row. Only an actual expression edit mints
one. That is the payoff for storing ids.

Old formula rows are retained on the same terms as historical change sets and
purged with them, since that is exactly how far back an undo can reach anyway.

**Two operations, not one.** `set` points a block at a different formula. A
separate `duplicate` covers the case where an edit should branch a version, and
dropping the old one is its own step — so a formula can be repointed without
minting, and minted without immediately losing what it replaced.

**Decisions baked in**

- **Stateless evaluation.** Even with ids, nothing caches a dependency graph:
  order is derived from the formulas at load, and persisting it would mean a
  second representation that can disagree with the first.
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
| **An op is a pure function on a body** | Nothing — it is a rule about what may be written | An op with an outside effect re-runs it on every read, because a read *is* a replay |
| Ids are unique within a resource | Whoever mints them | A path resolves to two things; the conflict ladder's identity check stops meaning anything |

## Related

[merge order](../../storage/merge-order.md) ·
[data models](../../data-models/) ·
[decisions](../decisions/2026-08-16-convex-implementation.md)
