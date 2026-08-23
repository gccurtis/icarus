/**
 * A resource being edited: a document, a slide deck, or a spreadsheet, and every
 * part of one you can select.
 *
 * `docs/screen-panel-views/context/resource/` and `inspector/resource/` are what
 * these serve — fifty-eight panels across three editors, which is why the doors
 * are grouped by editor below rather than run together alphabetically.
 *
 * Three resources out of `cast.ts` carry all of it: the Q3 Resilience Memo, the
 * October board deck, and the Outage Cost Model. They are consistent with each
 * other on purpose — the 1,842,000 customer-minutes Mira asks about in a comment
 * is `C2` in the grid, the number the memo cites, and the value the deck's inline
 * formula resolves to. A reviewer who checks one against another should find them
 * agreeing.
 */
import { PROJECT, RESOURCES, type PersonId, type Resource } from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read.svelte";
import type { AnalyticListReference, AnalyticModel } from "$json-store/types/data/analytic";
import type { ChartModel } from "$json-store/types/data/chart";
import { asId } from "$json-store/types/core/id";
import {
  createBarChart,
  createPieChart,
  type ChartIdIssuer
} from "$lib/unique-components/chart/chart-model";

/** The three editors. Narrower than `ResourceKind`, which also covers what is not edited. */
export type EditorKind = "document" | "slides" | "spreadsheet";

const DOCUMENT_ID = "r-memo";
const DECK_ID = "r-board";
const SHEET_ID = "r-cost";

const resourceRecord = (id: string): Resource =>
  RESOURCES.find((candidate) => candidate.id === id) ?? RESOURCES[0];

// ---------------------------------------------------------------------------
// Shared: comments, Context, and Insert
// ---------------------------------------------------------------------------

/**
 * One thread on a resource, with its anchor at whatever granularity the editor
 * supports. The scope chips filter on `anchor.scope`, so a document's "Page 2"
 * and a grid's "This cell" are the same query with a different field read.
 */
export type ResourceComment = {
  readonly id: string;
  readonly resourceId: string;
  readonly author: PersonId;
  readonly authorName: string;
  readonly body: string;
  readonly age: string;
  readonly state: "open" | "resolved";
  readonly mentionsViewer: boolean;
  readonly anchor: {
    readonly scope: "resource" | "page" | "selection" | "slide" | "element" | "cell";
    /** How the anchor reads on the row — `C2`, `Slide 4`, `Page 2`. */
    readonly label?: string;
    readonly page?: number;
    readonly slide?: number;
    readonly address?: string;
    /** Present only on a text anchor. A cell address is not a quotation. */
    readonly text?: string;
  };
};

/**
 * A saved Context the resource's prompt blocks can look at, with what it
 * resolves to right now.
 *
 * `usedByBlocks` is on the row because the specification has not settled whether
 * this view lists the scopes in use here or every scope so one can be assigned.
 * Carrying the count lets a panel answer either way without a second door.
 */
export type ScopeInUse = {
  readonly id: string;
  readonly name: string;
  readonly resolves: number;
  readonly usedByBlocks: number;
};

/** One member of a resolved scope, for the bounded preview. */
export type ScopeSample = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
};

/** One entry in an Insert view. Every entry inserts, then selects what it inserted. */
export type InsertOption = {
  readonly id: string;
  readonly label: string;
  readonly group:
    | "Basics"
    | "Content"
    | "Data and AI"
    | "Structure"
    | "Charts";
  /** Said on the row where two neighbouring entries are easily confused. */
  readonly note?: string;
  /** Why the entry cannot be used yet. Absent on everything that works. */
  readonly blocked?: string;
};

const COMMENTS: readonly ResourceComment[] = [
  {
    id: "rc-1",
    resourceId: DOCUMENT_ID,
    author: "mira",
    authorName: "Mira Jain",
    body: "@ana can you confirm 1,842,000 against the relay log?",
    age: "2h",
    state: "open",
    mentionsViewer: true,
    anchor: {
      scope: "selection",
      label: "Page 2",
      page: 2,
      text: "nearly a third of customer-minutes lost"
    }
  },
  {
    id: "rc-2",
    resourceId: DOCUMENT_ID,
    author: "mira",
    authorName: "Mira Jain",
    body: "Cite the docket number here.",
    age: "1d",
    state: "open",
    mentionsViewer: false,
    anchor: { scope: "page", label: "Page 3", page: 3 }
  },
  {
    id: "rc-3",
    resourceId: DOCUMENT_ID,
    author: "tomas",
    authorName: "Tomas Kaur",
    body: "The appendix should lead with the event count, not the table.",
    age: "2d",
    state: "open",
    mentionsViewer: false,
    anchor: { scope: "page", label: "Page 5", page: 5 }
  },
  {
    id: "rc-4",
    resourceId: DOCUMENT_ID,
    author: "ana",
    authorName: "Ana Reyes",
    body: "Fixed the units.",
    age: "3d",
    state: "resolved",
    mentionsViewer: false,
    anchor: { scope: "resource" }
  },
  {
    id: "rc-5",
    resourceId: DECK_ID,
    author: "tomas",
    authorName: "Tomas Kaur",
    body: "@ana is this the chart you wanted, on the same scale as slide 3?",
    age: "4h",
    state: "open",
    mentionsViewer: true,
    anchor: { scope: "element", label: "Slide 4 · Chart element", slide: 4 }
  },
  {
    id: "rc-6",
    resourceId: DECK_ID,
    author: "mira",
    authorName: "Mira Jain",
    body: "Slide 8 is hidden — is that deliberate before the board reads it?",
    age: "1d",
    state: "open",
    mentionsViewer: false,
    anchor: { scope: "slide", label: "Slide 8", slide: 8 }
  },
  {
    id: "rc-7",
    resourceId: DECK_ID,
    author: "devi",
    authorName: "Devi Okonkwo",
    body: "The wordmark is cut off at the bottom on the projector.",
    age: "5d",
    state: "open",
    mentionsViewer: false,
    anchor: { scope: "resource" }
  },
  {
    id: "rc-8",
    resourceId: SHEET_ID,
    author: "mira",
    authorName: "Mira Jain",
    body: "@ana corrected total or the old one? The event log says 1,840,200.",
    age: "1d",
    state: "open",
    mentionsViewer: true,
    anchor: { scope: "cell", label: "C2", address: "C2" }
  },
  {
    id: "rc-9",
    resourceId: SHEET_ID,
    author: "tomas",
    authorName: "Tomas Kaur",
    body: "D8 has been broken since the Feeder 12 range was deleted.",
    age: "2d",
    state: "open",
    mentionsViewer: false,
    anchor: { scope: "cell", label: "D8", address: "D8" }
  },
  {
    id: "rc-10",
    resourceId: SHEET_ID,
    author: "mira",
    authorName: "Mira Jain",
    body: "Cedar Line costs 20% more per avoided minute than everything else. Worth a line in the memo.",
    age: "4d",
    state: "open",
    mentionsViewer: false,
    anchor: { scope: "cell", label: "G5", address: "G5" }
  }
];

const SCOPES: readonly ScopeInUse[] = [
  { id: "sc-field", name: "Field reports 2024–25", resolves: 96, usedByBlocks: 2 },
  { id: "sc-reg", name: "Regulatory corpus", resolves: 34, usedByBlocks: 1 },
  { id: "sc-accepted", name: "Accepted findings", resolves: 18, usedByBlocks: 0 }
];

const SCOPE_SAMPLES: Readonly<Record<string, readonly ScopeSample[]>> = {
  "sc-field": [
    { id: "ss-1", name: "storm-log-2026-01.csv", kind: "File" },
    { id: "ss-2", name: "feeder-12-relay.pdf", kind: "File" },
    { id: "ss-3", name: "Ward 3 undergrounding report", kind: "Document" },
    { id: "ss-4", name: "NERC-2025-winter-review.pdf", kind: "File" }
  ],
  "sc-reg": [
    { id: "ss-5", name: "Docket 2026-114 — filing rules", kind: "Document" },
    { id: "ss-6", name: "Commission register, part 9", kind: "Document" },
    { id: "ss-7", name: "2024 storm precedent order", kind: "File" }
  ],
  "sc-accepted": [
    { id: "ss-8", name: "Undergrounding cut SAIDI 38%", kind: "Finding" },
    { id: "ss-9", name: "Feeder 12 relay mis-coordinated", kind: "Finding" },
    { id: "ss-10", name: "Restoration crews arrived 4h late in Ward 3", kind: "Finding" }
  ]
};

const INSERT_OPTIONS: Readonly<Record<EditorKind, readonly InsertOption[]>> = {
  document: [
    { id: "ins-d-text", label: "Text block", group: "Basics" },
    { id: "ins-d-heading", label: "Heading", group: "Basics" },
    { id: "ins-d-list", label: "List", group: "Basics" },
    { id: "ins-d-check", label: "Checklist", group: "Basics" },
    { id: "ins-d-image", label: "Image", group: "Content" },
    { id: "ins-d-table", label: "Table", group: "Content" },
    { id: "ins-d-embed", label: "Embed", group: "Content", blocked: "No permitted sources yet" },
    {
      id: "ins-d-formula",
      label: "Formula",
      group: "Data and AI",
      note: "An expression, which may refer to a variable"
    },
    {
      id: "ins-d-prompt",
      label: "Prompt block",
      group: "Data and AI",
      note: "Generated against a Context, and re-run on open"
    },
    {
      id: "ins-d-variable",
      label: "Variable",
      group: "Data and AI",
      note: "A reference to a project variable, inline"
    },
    { id: "ins-d-divider", label: "Divider row", group: "Structure" },
    { id: "ins-d-break", label: "Explicit page break", group: "Structure" },
    { id: "ins-d-side", label: "Side-by-side row", group: "Structure" }
  ],
  slides: [
    { id: "ins-s-text", label: "Text", group: "Basics" },
    { id: "ins-s-image", label: "Image", group: "Basics" },
    { id: "ins-s-table", label: "Table", group: "Basics" },
    { id: "ins-s-embed", label: "Embed", group: "Data and AI" },
    {
      id: "ins-s-formula",
      label: "Formula",
      group: "Data and AI",
      note: "An expression inside a slide block"
    },
    {
      id: "ins-s-prompt",
      label: "Prompt block",
      group: "Data and AI",
      note: "Runs when the slide is shown"
    },
    {
      id: "ins-s-variable",
      label: "Variable",
      group: "Data and AI",
      note: "A reference to a project variable"
    }
  ],
  spreadsheet: [
    { id: "ins-g-column", label: "Column", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-bar", label: "Bar", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-line", label: "Line", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-area", label: "Area", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-scatter", label: "Scatter", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-bubble", label: "Bubble", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-pie", label: "Pie", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-waterfall", label: "Waterfall", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-mekko", label: "Mekko", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-funnel", label: "Funnel", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-radar", label: "Radar", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-heatmap", label: "Heatmap", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    { id: "ins-g-treemap", label: "Treemap", group: "Charts", blocked: "Range-to-chart creation is not wired" },
    {
      id: "ins-g-formula",
      label: "Formula",
      group: "Content",
      note: "An expression, which may use a variable or a named range"
    },
    {
      id: "ins-g-variable",
      label: "Variable",
      group: "Content",
      note: "A reference to a project variable"
    },
    {
      id: "ins-g-prompt",
      label: "Prompt block",
      group: "Content",
      blocked: "Undecided whether it is an overlay or a multi-cell region"
    },
    { id: "ins-g-rows", label: "Rows above", group: "Structure" },
    { id: "ins-g-cols", label: "Columns left", group: "Structure" },
    { id: "ins-g-merge", label: "Merge selection", group: "Structure" }
  ]
};

/** Every thread on one resource, open and resolved together, newest first. */
export const commentsOn = (resourceId: string): Read<readonly ResourceComment[]> =>
  read(COMMENTS.filter((comment) => comment.resourceId === resourceId), "resource.commentsOn");

/** The Contexts this resource's prompt blocks run against, plus what is assignable. */
export const contextsFor = (resourceId: string): Read<readonly ScopeInUse[]> => {
  void resourceId;
  return read(SCOPES, "resource.contextsFor");
};

/** A bounded sample of one scope, so a scope that has drifted is visible before a block runs. */
export const resolvedPreview = (scopeId: string): Read<readonly ScopeSample[]> =>
  read(SCOPE_SAMPLES[scopeId] ?? [], "resource.resolvedPreview");

export const insertOptions = (kind: EditorKind): Read<readonly InsertOption[]> =>
  read(INSERT_OPTIONS[kind], "resource.insertOptions");

// ---------------------------------------------------------------------------
// The document editor
// ---------------------------------------------------------------------------

export type DocumentRecord = {
  readonly id: string;
  readonly title: string;
  readonly pages: number;
  readonly words: number;
  readonly saved: string;
  readonly createdBy: string;
  readonly updated: string;
};

/**
 * One heading in the outline. `page` is a label on a computed layout, never an
 * identifier — it moves when paper or gutters change, which is why the row says
 * so rather than leaving a reader to assume it is an address.
 */
export type OutlineEntry = {
  readonly id: string;
  readonly text: string;
  readonly level: 1 | 2 | 3;
  readonly page: number;
};

export type PageRow = {
  readonly number: number;
  /** The first heading that starts on the page, absent when the page only continues one. */
  readonly firstHeading?: string;
  readonly continues?: string;
};

export type FurnitureRow = {
  readonly id: string;
  readonly label: string;
  readonly kind: "break" | "header" | "footer";
  readonly page?: number;
};

export type PageSetup = {
  readonly paper: "Letter" | "A4";
  readonly orientation: "Portrait" | "Landscape";
  /** Named inside and outside rather than left and right, so the setting survives a page turn. */
  readonly margins: {
    readonly top: string;
    readonly bottom: string;
    readonly inside: string;
    readonly outside: string;
  };
  readonly headerBand: string;
  readonly footerBand: string;
  readonly firstPageDiffers: boolean;
  readonly numbering: {
    readonly startAt: number;
    readonly position: string;
    readonly showOnFirst: boolean;
  };
};

/** A named text style. Family, size, indentation and spacing live here, never on a selection. */
export type NamedTextStyle = {
  readonly id: string;
  readonly name: string;
  readonly basedOn: string;
  readonly family: string;
  readonly size: string;
  readonly lineHeight: string;
  readonly weight: number;
  readonly spaceAfter: string;
  readonly indent: string;
  /** Enough to tell two styles apart in a list without opening either. */
  readonly shorthand: string;
  readonly usedByBlocks: number;
};

/**
 * One search hit. `replaceable` is false for a hit inside generated output — the
 * next run overwrites it — and the panel disables Replace on those rather than
 * letting a replacement quietly disappear.
 */
export type DocumentHit = {
  readonly id: string;
  readonly before: string;
  readonly match: string;
  readonly after: string;
  readonly page: number;
  readonly source: "Body" | "Heading" | "Prompt block output" | "Table";
  readonly blockId?: string;
  readonly replaceable: boolean;
};

export type TextBlock = {
  readonly id: string;
  readonly text: string;
  readonly variant: "Body" | "Heading 1" | "Heading 2" | "Quote" | "Code";
  readonly alignment: "Left" | "Center" | "Right";
  readonly spaceBefore: string;
  readonly spaceAfter: string;
  readonly styleId: string;
  readonly rowPosition: string;
  /** Computed, and marked as such so it is never mistaken for an address. */
  readonly page: number;
};

export type TextSelection = {
  readonly text: string;
  readonly characters: number;
  readonly blockId: string;
  readonly styleId: string;
  readonly styleName: string;
};

export type MarkOption = {
  readonly id: string;
  readonly label: string;
  readonly active: boolean;
};

export type HeaderFurniture = {
  readonly content: string;
  readonly fromTop: string;
  /** Measured from content rather than set, which is why the panel shows it as a fact. */
  readonly height: string;
  readonly firstPageDiffers: boolean;
  readonly firstPageContent: string;
};

export type FooterFurniture = {
  /** Carries a `{page}` placeholder, never a literal number — the number is generated. */
  readonly content: string;
  readonly fromBottom: string;
  readonly numberPosition: string;
  readonly startAt: number;
  readonly showOnFirst: boolean;
};

export type PromptBlock = {
  readonly id: string;
  readonly prompt: string;
  readonly output: string;
  readonly scopeId: string;
  readonly scopeName: string;
  readonly scopeResolves: number;
  readonly lastRun: string;
  readonly model: string;
};

export type DocumentTable = {
  readonly id: string;
  readonly rows: number;
  readonly headerRow: boolean;
  readonly columns: number;
  /** Proportional, so the table survives a change of paper or gutters. */
  readonly columnWidths: readonly string[];
};

export type LinkMark = {
  readonly id: string;
  readonly url: string;
  readonly text: string;
  readonly internal: boolean;
};

export type InlineFormula = {
  readonly id: string;
  readonly shows: string;
  readonly expression: string;
  /** The project variable the expression resolves to, for the Open variable route. */
  readonly variable: string;
  readonly type: "number" | "text" | "date" | "logic";
  readonly readsWhen: string;
  readonly displayFormat: string;
};

const DOCUMENT_STYLES: readonly NamedTextStyle[] = [
  {
    id: "ds-body",
    name: "Body",
    basedOn: "Default",
    family: "IBM Plex Sans",
    size: "15 pt",
    lineHeight: "26 pt",
    weight: 400,
    spaceAfter: "8 pt",
    indent: "0 in",
    shorthand: "IBM Plex Sans 15/26",
    usedByBlocks: 41
  },
  {
    id: "ds-h1",
    name: "Heading 1",
    basedOn: "Body",
    family: "IBM Plex Sans",
    size: "24 pt",
    lineHeight: "32 pt",
    weight: 600,
    spaceAfter: "16 pt",
    indent: "0 in",
    shorthand: "IBM Plex Sans 24/32 · 600",
    usedByBlocks: 1
  },
  {
    id: "ds-h2",
    name: "Heading 2",
    basedOn: "Body",
    family: "IBM Plex Sans",
    size: "18 pt",
    lineHeight: "28 pt",
    weight: 600,
    spaceAfter: "12 pt",
    indent: "0 in",
    shorthand: "IBM Plex Sans 18/28 · 600",
    usedByBlocks: 3
  },
  {
    id: "ds-caption",
    name: "Filing caption",
    basedOn: "Body",
    family: "IBM Plex Mono",
    size: "12 pt",
    lineHeight: "16 pt",
    weight: 400,
    spaceAfter: "4 pt",
    indent: "0 in",
    shorthand: "IBM Plex Mono 12/16",
    usedByBlocks: 6
  },
  {
    id: "ds-quote",
    name: "Statutory quote",
    basedOn: "Body",
    family: "IBM Plex Serif",
    size: "15 pt",
    lineHeight: "26 pt",
    weight: 400,
    spaceAfter: "12 pt",
    indent: "0.5 in",
    shorthand: "IBM Plex Serif 15/26 · indented",
    usedByBlocks: 2
  }
];

const DOCUMENT_BLOCKS: readonly TextBlock[] = [
  {
    id: "b_1a0",
    text: "Q3 Resilience Memo",
    variant: "Heading 1",
    alignment: "Left",
    spaceBefore: "0 pt",
    spaceAfter: "16 pt",
    styleId: "ds-h1",
    rowPosition: "1 block of 1",
    page: 1
  },
  {
    id: "b_3d7",
    text: "What the field data shows",
    variant: "Heading 2",
    alignment: "Left",
    spaceBefore: "12 pt",
    spaceAfter: "6 pt",
    styleId: "ds-h2",
    rowPosition: "1 block of 1",
    page: 2
  },
  {
    id: "b_4f1",
    text: "Northwind lost 2,605,270 customer-minutes across the three storm events, nearly a third of customer-minutes lost on four feeders alone.",
    variant: "Body",
    alignment: "Left",
    spaceBefore: "12 pt",
    spaceAfter: "6 pt",
    styleId: "ds-body",
    rowPosition: "1 block of 1",
    page: 2
  },
  {
    id: "b_6e8",
    text: "Recommendation",
    variant: "Heading 2",
    alignment: "Left",
    spaceBefore: "12 pt",
    spaceAfter: "6 pt",
    styleId: "ds-h2",
    rowPosition: "1 block of 1",
    page: 3
  },
  {
    id: "b_7b3",
    text: "Underground the Millbrook and Ward 3 segments first, at 42 dollars per avoided customer-minute.",
    variant: "Body",
    alignment: "Left",
    spaceBefore: "12 pt",
    spaceAfter: "6 pt",
    styleId: "ds-body",
    rowPosition: "1 of 2 in a side-by-side row",
    page: 3
  },
  {
    id: "b_9a2",
    text: "The 2024 storm precedent docket allowed recovery on the same evidentiary basis.",
    variant: "Body",
    alignment: "Left",
    spaceBefore: "12 pt",
    spaceAfter: "6 pt",
    styleId: "ds-body",
    rowPosition: "1 block of 1",
    page: 5
  }
];

export const documentRecord = (documentId: string): Read<DocumentRecord> => {
  const record = resourceRecord(documentId);
  return read({
    id: record.id,
    title: record.name,
    pages: 5,
    words: 1204,
    saved: "All changes saved",
    createdBy: "Ana Reyes",
    updated: record.updated
  }, "resource.documentRecord");
};

export const outlineIn = (documentId: string): Read<readonly OutlineEntry[]> => {
  void documentId;
  return read([
    { id: "o-1", text: "Q3 Resilience Memo", level: 1, page: 1 },
    { id: "o-2", text: "What the field data shows", level: 2, page: 2 },
    { id: "o-3", text: "Recommendation", level: 2, page: 3 },
    { id: "o-4", text: "Statutory basis", level: 3, page: 3 },
    { id: "o-5", text: "Appendix — event log", level: 2, page: 5 }
  ], "resource.outlineIn");
};

export const pagesIn = (documentId: string): Read<readonly PageRow[]> => {
  void documentId;
  return read([
    { number: 1, firstHeading: "Q3 Resilience Memo" },
    { number: 2, firstHeading: "What the field data shows" },
    { number: 3, firstHeading: "Recommendation" },
    { number: 4, continues: "Statutory basis" },
    { number: 5, firstHeading: "Appendix — event log" }
  ], "resource.pagesIn");
};

/** Explicit structure the author put in, plus the routes to the two canonical furniture editors. */
export const furnitureIn = (documentId: string): Read<readonly FurnitureRow[]> => {
  void documentId;
  return read([
    { id: "f-1", label: "Explicit page break", kind: "break", page: 4 },
    { id: "f-2", label: "Header", kind: "header" },
    { id: "f-3", label: "Footer", kind: "footer" }
  ], "resource.furnitureIn");
};

export const pageSetup = (documentId: string): Read<PageSetup> => {
  void documentId;
  return read({
    paper: "Letter",
    orientation: "Portrait",
    margins: { top: "1.00 in", bottom: "1.00 in", inside: "1.25 in", outside: "1.00 in" },
    headerBand: "0.5 in",
    footerBand: "0.5 in",
    firstPageDiffers: true,
    numbering: { startAt: 1, position: "Footer, outside", showOnFirst: false }
  }, "resource.pageSetup");
};

export const documentStyles = (documentId: string): Read<readonly NamedTextStyle[]> => {
  void documentId;
  return read(DOCUMENT_STYLES, "resource.documentStyles");
};

export const documentStyle = (styleId: string): Read<NamedTextStyle> =>
  read(
    DOCUMENT_STYLES.find((style) => style.id === styleId) ?? DOCUMENT_STYLES[0],
    "resource.documentStyle"
  );

/**
 * Hits for one query. The mock answers the canonical query only — "storm" here,
 * "relay" in the deck, "minute" in the grid — because a real search wants an
 * index and a panel wants rows either way.
 */
export const findInDocument = (
  documentId: string,
  query: string
): Read<readonly DocumentHit[]> => {
  void documentId;
  void query;
  return read([
    {
      id: "dh-1",
      before: "…lost across the three ",
      match: "storm",
      after: " events…",
      page: 2,
      source: "Body",
      blockId: "b_4f1",
      replaceable: true
    },
    {
      id: "dh-2",
      before: "…comparable overhead segments under ",
      match: "storm",
      after: " icing…",
      page: 2,
      source: "Prompt block output",
      blockId: "b_5c2",
      replaceable: false
    },
    {
      id: "dh-3",
      before: "…the 2024 ",
      match: "storm",
      after: " precedent docket…",
      page: 5,
      source: "Body",
      blockId: "b_9a2",
      replaceable: true
    },
    {
      id: "dh-4",
      before: "…minutes lost per ",
      match: "storm",
      after: " event, by feeder…",
      page: 5,
      source: "Table",
      blockId: "b_8d4",
      replaceable: true
    }
  ], "resource.findInDocument");
};

export const textBlock = (blockId: string): Read<TextBlock> =>
  read(
    DOCUMENT_BLOCKS.find((block) => block.id === blockId) ?? DOCUMENT_BLOCKS[1],
    "resource.textBlock"
  );

/** The selection resolved to text. Offsets were internals and are not part of the answer. */
export const textSelection = (documentId: string): Read<TextSelection> => {
  void documentId;
  return read({
    text: "nearly a third of customer-minutes lost",
    characters: 39,
    blockId: "b_4f1",
    styleId: "ds-body",
    styleName: "Body"
  }, "resource.textSelection");
};

/** The mark set a body model supports. A deck block has no strike or code; a document has both. */
export const marksFor = (kind: EditorKind): Read<readonly MarkOption[]> =>
  read(
    kind === "slides"
      ? [
          { id: "m-bold", label: "Bold", active: false },
          { id: "m-italic", label: "Italic", active: false },
          { id: "m-underline", label: "Underline", active: false },
          { id: "m-link", label: "Link", active: false }
        ]
      : [
          { id: "m-bold", label: "Bold", active: true },
          { id: "m-italic", label: "Italic", active: false },
          { id: "m-underline", label: "Underline", active: false },
          { id: "m-strike", label: "Strike", active: false },
          { id: "m-code", label: "Code", active: false }
        ],
    "resource.marksFor"
  );

export const documentHeader = (documentId: string): Read<HeaderFurniture> => {
  void documentId;
  return read({
    content: `${PROJECT.name} — Commission filing`,
    fromTop: "0.5 in",
    height: "0.76 in",
    firstPageDiffers: true,
    firstPageContent: "Empty"
  }, "resource.documentHeader");
};

export const documentFooter = (documentId: string): Read<FooterFurniture> => {
  void documentId;
  return read({
    content: "Docket 2026-114        {page}",
    fromBottom: "0.5 in",
    numberPosition: "Outside",
    startAt: 1,
    showOnFirst: false
  }, "resource.documentFooter");
};

/**
 * A block whose content is generated. It runs on open, so what is on the page was
 * generated against the project as it is now — there is no stale marker here and
 * none is wanted.
 */
export const promptBlock = (blockId: string): Read<PromptBlock> => {
  void blockId;
  return read({
    id: "b_5c2",
    prompt:
      "Compare undergrounded and overhead segment performance across the three storm events.",
    output:
      "Undergrounded segments lost 38% fewer customer-minutes than comparable overhead segments under storm icing, and none of the three events produced a repeat failure on an undergrounded run. The gap is widest on Millbrook, where the overhead spur carried two of the four recorded failures.",
    scopeId: "sc-field",
    scopeName: "Field reports 2024–25",
    scopeResolves: 96,
    lastRun: "on open",
    model: "analyst-default"
  }, "resource.promptBlock");
};

/** A document table is content: no addresses, no formulas, no calculation. */
export const documentTable = (tableId: string): Read<DocumentTable> => {
  void tableId;
  return read({
    id: "b_8d4",
    rows: 4,
    headerRow: true,
    columns: 3,
    columnWidths: ["48%", "20%", "32%"]
  }, "resource.documentTable");
};

export const link = (linkId: string): Read<LinkMark> => {
  void linkId;
  return read({
    id: "lk-1",
    url: "https://nerc.gov/docket/2026-114",
    text: "the 2026 docket",
    internal: false
  }, "resource.link");
};

export const inlineFormula = (formulaId: string): Read<InlineFormula> => {
  void formulaId;
  return read({
    id: "if-1",
    shows: "$46.0M",
    expression: "=hardeningBudget",
    variable: "hardeningBudget",
    type: "number",
    readsWhen: "on open, and on every change",
    displayFormat: '$#,##0.0,,"M"'
  }, "resource.inlineFormula");
};

// ---------------------------------------------------------------------------
// The slide deck editor
// ---------------------------------------------------------------------------

export type DeckRecord = {
  readonly id: string;
  readonly title: string;
  readonly slides: number;
  readonly aspectRatio: string;
  readonly saved: string;
  readonly handout: { readonly paper: string; readonly perPage: number };
  readonly updated: string;
};

/**
 * A slide. It has no persisted name — the title is read out of its title element
 * — which is why a section list cannot be read as text and every list of slides
 * needs a thumbnail beside it.
 */
export type Slide = {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly sectionId: string;
  readonly sectionName: string;
  readonly layoutId: string;
  readonly layoutName: string;
  readonly hidden: boolean;
  readonly background: string;
};

/** A section is anchored to its first slide, so reordering re-interprets the boundaries. */
export type DeckSection = {
  readonly id: string;
  readonly name: string;
  readonly firstSlide: number;
  readonly slides: number;
};

/** One object on the slide. List order is stacking order, front first. */
export type SlideLayer = {
  readonly id: string;
  readonly name: string;
  readonly kind: "text" | "chart" | "image" | "table";
  readonly depth: "Front" | "Middle" | "Back";
};

export type LockedElement = {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly owner: "Layout";
};

export type SlideLayout = {
  readonly id: string;
  readonly name: string;
  readonly placeholders: number;
  readonly locked: number;
  /** How many slides an edit here will change. The number that matters. */
  readonly usedBy: number;
  readonly backgroundSource: string;
};

/**
 * A layout placeholder. It has no stable key, so it is addressed by its position
 * in the layout's list and a duplicate role has to be described by its neighbour
 * rather than named.
 */
export type Placeholder = {
  readonly index: number;
  readonly role: "title" | "body" | "chart" | "caption";
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly styleKey: string;
  readonly sameRoleAsAbove: boolean;
};

/**
 * A theme colour has a name and no role, which is why nothing on a slide can ask
 * for "the accent" and every use of one is a literal that will not follow a theme
 * change. The value is a semantic token rather than a hex string, so the four
 * swatches a panel draws are the palette the rest of the product uses.
 */
export type ThemeColor = {
  readonly id: string;
  readonly name: string;
  readonly token: string;
};

export type DeckTheme = {
  readonly backgroundKind: "Solid";
  readonly backgroundColor: string;
  readonly family: string;
  readonly colors: readonly ThemeColor[];
  readonly usedBySlides: number;
  readonly usedByLayouts: number;
};

/** A deck style carries a key as well as a name: a placeholder names a style by key. */
export type NamedDeckStyle = {
  readonly id: string;
  readonly name: string;
  readonly styleKey: string;
  readonly family: string;
  readonly size: string;
  readonly weight: number;
  readonly shorthand: string;
  readonly usedByElements: number;
};

export type SlideNotes = {
  readonly slideId: string;
  readonly index: number;
  readonly title: string;
  /** A paragraph count is cheap; a preview of every slide's notes is not. */
  readonly summary: "No notes" | "One paragraph" | "Two paragraphs";
  readonly content: string;
};

export type DeckHit = {
  readonly id: string;
  readonly before: string;
  readonly match: string;
  readonly after: string;
  readonly slide: number;
  readonly source: "Title" | "Body text" | "Speaker notes" | "Appendix table";
  readonly blockId?: string;
};

/**
 * An element is a box on the canvas. Its frame is fractions of the slide so a deck
 * survives a change of aspect ratio; what is inside it is a block with its own lens.
 */
export type SlideElement = {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly rotation: number;
  readonly overflow: "Clip" | "Shrink" | "Grow";
  readonly fill: string;
  readonly border: string;
  readonly padding: string;
  readonly fromPlaceholder?: string;
  readonly resetEligible: string;
};

export type DeckTextBlock = {
  readonly id: string;
  readonly text: string;
  readonly styleId: string;
  readonly styleName: string;
  readonly alignment: "Left" | "Center" | "Right";
  readonly formulas: readonly {
    readonly id: string;
    readonly expression: string;
    readonly shows: string;
    readonly readsWhen: string;
  }[];
};

/** Where a selection agrees and where it does not. *Mixed* is a value, and setting over it applies to all. */
export type SharedProperty = {
  readonly label: string;
  readonly value: string;
  readonly mixed: boolean;
};

export type MultiSelection = {
  readonly members: readonly { readonly id: string; readonly name: string }[];
  readonly geometry: readonly SharedProperty[];
  readonly format: readonly SharedProperty[];
  /** Distribute needs three, so it is inert with two. */
  readonly canDistribute: boolean;
};

const DECK_SECTIONS: readonly DeckSection[] = [
  { id: "sec-open", name: "Opening", firstSlide: 1, slides: 2 },
  { id: "sec-case", name: "The case", firstSlide: 3, slides: 4 },
  { id: "sec-close", name: "Close", firstSlide: 7, slides: 2 }
];

const SLIDES: readonly Slide[] = [
  {
    id: "sl-1",
    index: 1,
    title: "Board Update — October",
    sectionId: "sec-open",
    sectionName: "Opening",
    layoutId: "ly-title",
    layoutName: "Title slide",
    hidden: false,
    background: "Inherited from layout"
  },
  {
    id: "sl-2",
    index: 2,
    title: "Where we stand",
    sectionId: "sec-open",
    sectionName: "Opening",
    layoutId: "ly-two-panes",
    layoutName: "Title and two panes",
    hidden: false,
    background: "Inherited from layout"
  },
  {
    id: "sl-3",
    index: 3,
    title: "Three storm events",
    sectionId: "sec-case",
    sectionName: "The case",
    layoutId: "ly-two-panes",
    layoutName: "Title and two panes",
    hidden: false,
    background: "Inherited from layout"
  },
  {
    id: "sl-4",
    index: 4,
    title: "Feeder 12 in detail",
    sectionId: "sec-case",
    sectionName: "The case",
    layoutId: "ly-two-panes",
    layoutName: "Title and two panes",
    hidden: false,
    background: "Inherited from layout"
  },
  {
    id: "sl-5",
    index: 5,
    title: "What hardening costs",
    sectionId: "sec-case",
    sectionName: "The case",
    layoutId: "ly-chart",
    layoutName: "Full-bleed chart",
    hidden: false,
    background: "Inherited from layout"
  },
  {
    id: "sl-6",
    index: 6,
    title: "Cost per avoided minute",
    sectionId: "sec-case",
    sectionName: "The case",
    layoutId: "ly-two-panes",
    layoutName: "Title and two panes",
    hidden: false,
    background: "Inherited from layout"
  },
  {
    id: "sl-7",
    index: 7,
    title: "Recommendation",
    sectionId: "sec-close",
    sectionName: "Close",
    layoutId: "ly-section",
    layoutName: "Section break",
    hidden: false,
    background: "Inherited from layout"
  },
  {
    id: "sl-8",
    index: 8,
    title: "Appendix — relay coordination",
    sectionId: "sec-close",
    sectionName: "Close",
    layoutId: "ly-section",
    layoutName: "Section break",
    hidden: true,
    background: "Inherited from layout"
  }
];

const LAYOUTS: readonly SlideLayout[] = [
  {
    id: "ly-two-panes",
    name: "Title and two panes",
    placeholders: 3,
    locked: 2,
    usedBy: 4,
    backgroundSource: "Inherited from theme"
  },
  {
    id: "ly-title",
    name: "Title slide",
    placeholders: 2,
    locked: 0,
    usedBy: 1,
    backgroundSource: "Inherited from theme"
  },
  {
    id: "ly-section",
    name: "Section break",
    placeholders: 1,
    locked: 1,
    usedBy: 2,
    backgroundSource: "Solid · Ink"
  },
  {
    id: "ly-chart",
    name: "Full-bleed chart",
    placeholders: 1,
    locked: 1,
    usedBy: 1,
    backgroundSource: "Inherited from theme"
  },
  {
    id: "ly-blank",
    name: "Blank",
    placeholders: 0,
    locked: 0,
    usedBy: 0,
    backgroundSource: "Inherited from theme"
  }
];

const PLACEHOLDERS: Readonly<Record<string, readonly Placeholder[]>> = {
  "ly-two-panes": [
    {
      index: 0,
      role: "title",
      frame: { x: 0.07, y: 0.11, w: 0.86, h: 0.16 },
      styleKey: "title",
      sameRoleAsAbove: false
    },
    {
      index: 1,
      role: "body",
      frame: { x: 0.07, y: 0.33, w: 0.44, h: 0.44 },
      styleKey: "body",
      sameRoleAsAbove: false
    },
    {
      index: 2,
      role: "body",
      frame: { x: 0.53, y: 0.33, w: 0.44, h: 0.44 },
      styleKey: "body",
      sameRoleAsAbove: true
    }
  ],
  "ly-title": [
    {
      index: 0,
      role: "title",
      frame: { x: 0.1, y: 0.38, w: 0.8, h: 0.18 },
      styleKey: "title",
      sameRoleAsAbove: false
    },
    {
      index: 1,
      role: "caption",
      frame: { x: 0.1, y: 0.58, w: 0.8, h: 0.08 },
      styleKey: "caption",
      sameRoleAsAbove: false
    }
  ],
  "ly-section": [
    {
      index: 0,
      role: "title",
      frame: { x: 0.08, y: 0.44, w: 0.84, h: 0.16 },
      styleKey: "title",
      sameRoleAsAbove: false
    }
  ],
  "ly-chart": [
    {
      index: 0,
      role: "chart",
      frame: { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
      styleKey: "body",
      sameRoleAsAbove: false
    }
  ],
  "ly-blank": []
};

const LOCKED_ELEMENTS: readonly LockedElement[] = [
  {
    id: "le-wordmark",
    name: "Footer wordmark",
    content: PROJECT.name,
    frame: { x: 0.04, y: 0.8, w: 0.26, h: 0.05 },
    owner: "Layout"
  },
  {
    id: "le-number",
    name: "Slide number",
    content: "{slide}",
    frame: { x: 0.92, y: 0.88, w: 0.04, h: 0.04 },
    owner: "Layout"
  }
];

const DECK_STYLES: readonly NamedDeckStyle[] = [
  {
    id: "ks-title",
    name: "Slide title",
    styleKey: "title",
    family: "IBM Plex Sans",
    size: "24 pt",
    weight: 600,
    shorthand: "24/32 · 600",
    usedByElements: 8
  },
  {
    id: "ks-body",
    name: "Body",
    styleKey: "body",
    family: "IBM Plex Sans",
    size: "13 pt",
    weight: 400,
    shorthand: "13/20 · 400",
    usedByElements: 14
  },
  {
    id: "ks-caption",
    name: "Caption",
    styleKey: "caption",
    family: "IBM Plex Mono",
    size: "10 pt",
    weight: 400,
    shorthand: "10/14 · mono",
    usedByElements: 5
  },
  {
    id: "ks-stat",
    name: "Statistic",
    styleKey: "stat",
    family: "IBM Plex Sans",
    size: "40 pt",
    weight: 300,
    shorthand: "40/44 · 300",
    usedByElements: 3
  }
];

const NOTES: readonly SlideNotes[] = [
  {
    slideId: "sl-1",
    index: 1,
    title: "Board Update — October",
    summary: "No notes",
    content: ""
  },
  {
    slideId: "sl-2",
    index: 2,
    title: "Where we stand",
    summary: "Two paragraphs",
    content:
      "Open on the deadline, not the storms. The filing is due 14 November and the evidence is closed a fortnight before that.\n\nIf the board asks about the 46 million, say it is the request, not the spend to date."
  },
  {
    slideId: "sl-3",
    index: 3,
    title: "Three storm events",
    summary: "One paragraph",
    content:
      "Three events, eleven weeks, 2,605,270 customer-minutes on four feeders. Do not read the table out."
  },
  {
    slideId: "sl-4",
    index: 4,
    title: "Feeder 12 in detail",
    summary: "One paragraph",
    content:
      "Lead with the relay finding, not the spend. If asked about the 2024 precedent, the docket number is in the appendix."
  },
  {
    slideId: "sl-5",
    index: 5,
    title: "What hardening costs",
    summary: "One paragraph",
    content: "The chart is spend, not recovery. Say so before the first question."
  },
  {
    slideId: "sl-6",
    index: 6,
    title: "Cost per avoided minute",
    summary: "Two paragraphs",
    content:
      "Forty-two dollars an avoided minute on Millbrook and Ward 3; fifty on Cedar Line.\n\nThat gap is the whole recommendation — sequence, not scope."
  },
  {
    slideId: "sl-7",
    index: 7,
    title: "Recommendation",
    summary: "One paragraph",
    content: "Ask for the sequencing decision here. Do not leave it to the appendix."
  },
  {
    slideId: "sl-8",
    index: 8,
    title: "Appendix — relay coordination",
    summary: "No notes",
    content: ""
  }
];

const ELEMENTS: readonly SlideElement[] = [
  {
    id: "el-title-4",
    name: "Title",
    content: "Feeder 12 in detail",
    frame: { x: 0.07, y: 0.11, w: 0.64, h: 0.16 },
    rotation: 0,
    overflow: "Shrink",
    fill: "None",
    border: "None",
    padding: "8 pt",
    fromPlaceholder: "title",
    resetEligible: "Yes — one match in this layout"
  },
  {
    id: "el-body-4",
    name: "Body text",
    content: "Three failures in eleven weeks, all traced to the same mis-coordinated relay pair.",
    frame: { x: 0.07, y: 0.33, w: 0.44, h: 0.44 },
    rotation: 0,
    overflow: "Grow",
    fill: "None",
    border: "None",
    padding: "8 pt",
    fromPlaceholder: "body",
    resetEligible: "No — two placeholders share this role"
  },
  {
    id: "el-chart-4",
    name: "Chart element",
    content: "Customer-minutes by feeder, three events",
    frame: { x: 0.53, y: 0.33, w: 0.44, h: 0.44 },
    rotation: 0,
    overflow: "Clip",
    fill: "Paper",
    border: "1 pt · Rule",
    padding: "12 pt",
    resetEligible: "No — not from a placeholder"
  }
];

export const deckRecord = (deckId: string): Read<DeckRecord> => {
  const record = resourceRecord(deckId);
  return read({
    id: record.id,
    title: record.name,
    slides: SLIDES.length,
    aspectRatio: "16:9",
    saved: "All changes saved",
    handout: { paper: "Letter", perPage: 3 },
    updated: record.updated
  }, "resource.deckRecord");
};

export const slidesIn = (deckId: string): Read<readonly Slide[]> => {
  void deckId;
  return read(SLIDES, "resource.slidesIn");
};

export const sectionsIn = (deckId: string): Read<readonly DeckSection[]> => {
  void deckId;
  return read(DECK_SECTIONS, "resource.sectionsIn");
};

export const slide = (slideId: string): Read<Slide> =>
  read(SLIDES.find((candidate) => candidate.id === slideId) ?? SLIDES[3], "resource.slide");

/** The slide's own objects, front to back. */
export const layersOn = (slideId: string): Read<readonly SlideLayer[]> => {
  void slideId;
  return read([
    { id: "el-chart-4", name: "Chart element", kind: "chart", depth: "Front" },
    { id: "el-body-4", name: "Body text", kind: "text", depth: "Middle" },
    { id: "el-title-4", name: "Title", kind: "text", depth: "Back" }
  ], "resource.layersOn");
};

/**
 * What the resolved layout owns and the slide cannot edit, shown so the slide is
 * complete rather than mysteriously missing its footer. Cross-layer order against
 * the slide's own objects is undefined, so these are a second list rather than
 * part of the first.
 */
export const layoutObjectsOn = (slideId: string): Read<readonly LockedElement[]> => {
  void slideId;
  return read(LOCKED_ELEMENTS, "resource.layoutObjectsOn");
};

export const layoutsIn = (deckId: string): Read<readonly SlideLayout[]> => {
  void deckId;
  return read(LAYOUTS, "resource.layoutsIn");
};

export const layout = (layoutId: string): Read<SlideLayout> =>
  read(LAYOUTS.find((candidate) => candidate.id === layoutId) ?? LAYOUTS[0], "resource.layout");

export const placeholdersIn = (layoutId: string): Read<readonly Placeholder[]> =>
  read(PLACEHOLDERS[layoutId] ?? [], "resource.placeholdersIn");

/** Addressed by position, because a placeholder has no stable key to address it by. */
export const placeholderAt = (layoutId: string, index: number): Read<Placeholder | undefined> =>
  read((PLACEHOLDERS[layoutId] ?? [])[index], "resource.placeholderAt");

export const lockedContentIn = (layoutId: string): Read<readonly LockedElement[]> => {
  const record = LAYOUTS.find((candidate) => candidate.id === layoutId) ?? LAYOUTS[0];
  return read(LOCKED_ELEMENTS.slice(0, record.locked), "resource.lockedContentIn");
};

export const lockedElement = (elementId: string): Read<LockedElement> =>
  read(
    LOCKED_ELEMENTS.find((candidate) => candidate.id === elementId) ?? LOCKED_ELEMENTS[0],
    "resource.lockedElement"
  );

export const deckTheme = (deckId: string): Read<DeckTheme> => {
  void deckId;
  return read({
    backgroundKind: "Solid",
    backgroundColor: "Paper",
    family: "IBM Plex Sans",
    colors: [
      { id: "tc-1", name: "Primary", token: "--token-color-primary-fill" },
      { id: "tc-2", name: "Secondary", token: "--token-color-secondary-fill" },
      { id: "tc-3", name: "Accent 1", token: "--token-color-accent-1-fill" },
      { id: "tc-4", name: "Accent 2", token: "--token-color-accent-2-fill" }
    ],
    usedBySlides: SLIDES.length,
    usedByLayouts: LAYOUTS.length
  }, "resource.deckTheme");
};

export const deckStyles = (deckId: string): Read<readonly NamedDeckStyle[]> => {
  void deckId;
  return read(DECK_STYLES, "resource.deckStyles");
};

export const deckStyle = (styleId: string): Read<NamedDeckStyle> =>
  read(DECK_STYLES.find((style) => style.id === styleId) ?? DECK_STYLES[0], "resource.deckStyle");

export const notesIn = (deckId: string): Read<readonly SlideNotes[]> => {
  void deckId;
  return read(NOTES, "resource.notesIn");
};

export const notesFor = (slideId: string): Read<SlideNotes> =>
  read(NOTES.find((note) => note.slideId === slideId) ?? NOTES[3], "resource.notesFor");

/** Deck-wide, and reaching into speaker notes, which are not on the canvas at all. */
export const findInDeck = (deckId: string, query: string): Read<readonly DeckHit[]> => {
  void deckId;
  void query;
  return read([
    {
      id: "kh-1",
      before: "…mis-coordinated ",
      match: "relay",
      after: " pair…",
      slide: 4,
      source: "Body text",
      blockId: "b_2c8"
    },
    {
      id: "kh-2",
      before: "…lead with the ",
      match: "relay",
      after: " finding, not the spend…",
      slide: 4,
      source: "Speaker notes"
    },
    {
      id: "kh-3",
      before: "…the ",
      match: "relay",
      after: " log confirms…",
      slide: 7,
      source: "Speaker notes"
    },
    {
      id: "kh-4",
      before: "…",
      match: "relay",
      after: " coordination study, 2024…",
      slide: 8,
      source: "Appendix table"
    }
  ], "resource.findInDeck");
};

export const element = (elementId: string): Read<SlideElement> =>
  read(ELEMENTS.find((candidate) => candidate.id === elementId) ?? ELEMENTS[0], "resource.element");

export const deckTextBlock = (blockId: string): Read<DeckTextBlock> => {
  void blockId;
  return read({
    id: "b_2c8",
    text: "Three failures in eleven weeks, all traced to the same mis-coordinated relay pair.",
    styleId: "ks-body",
    styleName: "Body",
    alignment: "Left",
    formulas: [
      {
        id: "if-2",
        expression: "=outageEvents.feeder12.minutes",
        shows: "1,842,000",
        readsWhen: "read when the slide is shown"
      }
    ]
  }, "resource.deckTextBlock");
};

/** A multi-selection is a different thing from an element, not a degraded one. */
export const multiSelection = (slideId: string): Read<MultiSelection> => {
  void slideId;
  return read({
    members: [
      { id: "el-title-4", name: "Title" },
      { id: "el-body-4", name: "Body text" },
      { id: "el-chart-4", name: "Chart element" }
    ],
    geometry: [
      { label: "Width", value: "Mixed", mixed: true },
      { label: "Height", value: "Mixed", mixed: true },
      { label: "Rotation", value: "0°", mixed: false }
    ],
    format: [
      { label: "Fill", value: "Mixed", mixed: true },
      { label: "Border", value: "Mixed", mixed: true },
      { label: "Padding", value: "8 pt", mixed: false }
    ],
    canDistribute: true
  }, "resource.multiSelection");
};

// ---------------------------------------------------------------------------
// The spreadsheet editor
// ---------------------------------------------------------------------------

export type SpreadsheetRecord = {
  readonly id: string;
  readonly title: string;
  readonly usedRange: string;
  readonly populatedCells: number;
  readonly saved: string;
  readonly updated: string;
};

/**
 * One persisted cell. The grid is sparse: a coordinate with nothing in it has no
 * cell here, which is why a range can be large and almost empty and why
 * formatting an empty range has nothing to be stored on.
 *
 * A cell's identity is its A1 address. Row and column are read off that address
 * rather than carried, because there is no row object and no column object for
 * them to belong to.
 */
export type Cell = {
  readonly address: string;
  readonly column: string;
  readonly row: number;
  /** What is stored, unformatted — `318400`, never `318,400`. */
  readonly content: string;
  /** What the grid draws, format applied. */
  readonly shows: string;
  readonly type: "number" | "text" | "logic" | "date";
  /** Present only where the content is an expression. */
  readonly formula?: string;
  readonly styleId?: string;
  readonly alignment: "left" | "center" | "right";
  readonly valueFormat?: string;
  /** Set on every cell a spill covers, the origin included. */
  readonly spillOrigin?: string;
  readonly error?: "#REF!" | "#NAME?" | "#DIV/0!" | "#VALUE!";
};

/** One end of a dependency, in either direction. */
export type CellReference = {
  readonly address: string;
  /** The value when the panel is showing reads; the formula when it is showing feeds. */
  readonly shows: string;
  readonly kind: "value" | "formula" | "spill child" | "named range" | "broken";
  readonly note?: string;
};

export type CellProblem = {
  readonly address: string;
  readonly error: "#REF!" | "#NAME?" | "#DIV/0!" | "#VALUE!";
  readonly formula: string;
  /** In words, per error kind. An error is a repair job, not a failure to report. */
  readonly explanation: string;
};

export type SpillInfo = {
  readonly origin: string;
  readonly occupied: string;
  readonly status: "Origin" | "Read-only child";
  readonly originFormula: string;
};

/**
 * A name that resolves inside this spreadsheet only — deliberately not the same
 * list as the project's variables, which resolve everywhere.
 */
export type NamedRange = {
  readonly id: string;
  readonly name: string;
  /** Left over from when a spreadsheet was a workbook of sheets, and due to go. */
  readonly sheet: string;
  readonly range: string;
  readonly referencedByFormulas: number;
};

/**
 * A floating analytic over the grid. The exact same model renders on an
 * analysis page, in a document block or on a slide; this projection adds only
 * the A1 placement strings the spreadsheet surface owns.
 */
export type SheetObject = {
  readonly id: string;
  readonly kind: "Column" | "Bar" | "Pie";
  readonly title: string;
  readonly sourceRange: string;
  readonly anchor: string;
  readonly size: { width: number; height: number };
  readonly overlapped: boolean;
  readonly model: AnalyticModel;
};

export type PrintSetup = {
  readonly paper: string;
  readonly orientation: "Portrait" | "Landscape";
  readonly scale: string;
  readonly printArea: string;
  readonly repeatRows: string;
  readonly repeatColumns: string;
  readonly gridlines: boolean;
  readonly headings: boolean;
};

export type NamedCellStyle = {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly alignment: "left" | "center" | "right";
  readonly valueFormat?: string;
  readonly border?: string;
  /** The distinguishing property, which is all a list row needs to tell two apart. */
  readonly shorthand: string;
  readonly usedByCells: number;
};

export type SheetHit = {
  readonly id: string;
  readonly address: string;
  readonly content: string;
  /** Which of the grid's two layers of text the hit came out of. */
  readonly layer: "formula" | "value";
};

export type Measure = {
  readonly label: string;
  readonly value: string;
};

export type RangeSelection = {
  readonly a1: string;
  /** Cells with content, and coordinates covered. The pair matters on a sparse grid. */
  readonly cellsWithContent: number;
  readonly coordinates: number;
  readonly formatting: readonly SharedProperty[];
  readonly aggregate: readonly Measure[];
};

type CellInput = Omit<Cell, "address" | "column" | "row" | "shows"> & { readonly shows?: string };

/** `shows` defaults to the content, because only a formatted number differs from what is stored. */
const at = (address: string, input: CellInput): Cell => ({
  ...input,
  address,
  column: address.replace(/[0-9]/g, ""),
  row: Number(address.replace(/[A-Z]/g, "")),
  shows: input.shows ?? input.content
});

const head = (address: string, content: string): Cell =>
  at(address, { content, type: "text", alignment: "center", styleId: "cs-header" });

/**
 * The Outage Cost Model: four feeders in `A1:G6`, and a scratch row 8 that has
 * been broken since someone deleted the Feeder 12 range.
 *
 * `C2` is 1,842,000 because that is the number Mira questions in a comment, the
 * number the memo cites, and the number the deck's inline formula resolves to.
 * `E2:E5` is one spill out of `avoidedMinutes`, so `E3` has a value and no
 * formula of its own.
 */
const CELLS: readonly Cell[] = [
  head("A1", "Substation"),
  head("B1", "Feeder"),
  head("C1", "Customer-minutes lost"),
  head("D1", "Storm events"),
  head("E1", "Avoided minutes (modelled)"),
  head("F1", "Hardening spend ($M)"),
  head("G1", "Cost per avoided minute"),

  at("A2", { content: "Millbrook", type: "text", alignment: "left" }),
  at("B2", { content: "F-12", type: "text", alignment: "left" }),
  at("C2", {
    content: "1842000",
    shows: "1,842,000",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0"
  }),
  at("D2", { content: "2", type: "number", alignment: "right" }),
  at("E2", {
    content: "=avoidedMinutes(costModel)",
    formula: "=avoidedMinutes(costModel)",
    shows: "268,110",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0",
    spillOrigin: "E2"
  }),
  at("F2", {
    content: "11.4",
    shows: "11.40",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),
  at("G2", {
    content: '=IF(E2=0,"",F2*1000000/E2)',
    formula: '=IF(E2=0,"",F2*1000000/E2)',
    shows: "42.52",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),

  at("A3", { content: "Ward 3", type: "text", alignment: "left" }),
  at("B3", { content: "F-04", type: "text", alignment: "left" }),
  at("C3", {
    content: "318400",
    shows: "318,400",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0"
  }),
  at("D3", { content: "3", type: "number", alignment: "right" }),
  at("E3", {
    content: "194224",
    shows: "194,224",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0",
    spillOrigin: "E2"
  }),
  at("F3", {
    content: "8.1",
    shows: "8.10",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),
  at("G3", {
    content: '=IF(E3=0,"",F3*1000000/E3)',
    formula: '=IF(E3=0,"",F3*1000000/E3)',
    shows: "41.70",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),

  at("A4", { content: "Harbor Point", type: "text", alignment: "left" }),
  at("B4", { content: "F-07", type: "text", alignment: "left" }),
  at("C4", {
    content: "286150",
    shows: "286,150",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0"
  }),
  at("D4", { content: "2", type: "number", alignment: "right" }),
  at("E4", {
    content: "171690",
    shows: "171,690",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0",
    spillOrigin: "E2"
  }),
  at("F4", {
    content: "7.25",
    shows: "7.25",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),
  at("G4", {
    content: '=IF(E4=0,"",F4*1000000/E4)',
    formula: '=IF(E4=0,"",F4*1000000/E4)',
    shows: "42.23",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),

  at("A5", { content: "Cedar Line", type: "text", alignment: "left" }),
  at("B5", { content: "F-19", type: "text", alignment: "left" }),
  at("C5", {
    content: "158720",
    shows: "158,720",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0"
  }),
  at("D5", { content: "1", type: "number", alignment: "right" }),
  at("E5", {
    content: "92057",
    shows: "92,057",
    type: "number",
    alignment: "right",
    styleId: "cs-minutes",
    valueFormat: "#,##0",
    spillOrigin: "E2"
  }),
  at("F5", {
    content: "4.6",
    shows: "4.60",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),
  at("G5", {
    content: '=IF(E5=0,"",F5*1000000/E5)',
    formula: '=IF(E5=0,"",F5*1000000/E5)',
    shows: "49.97",
    type: "number",
    alignment: "right",
    styleId: "cs-currency",
    valueFormat: "#,##0.00"
  }),

  at("A6", { content: "Total", type: "text", alignment: "left", styleId: "cs-total" }),
  at("B6", { content: "4 feeders", type: "text", alignment: "left", styleId: "cs-total" }),
  at("C6", {
    content: "=SUM(C2:C5)",
    formula: "=SUM(C2:C5)",
    shows: "2,605,270",
    type: "number",
    alignment: "right",
    styleId: "cs-total",
    valueFormat: "#,##0"
  }),
  at("D6", {
    content: "=SUM(D2:D5)",
    formula: "=SUM(D2:D5)",
    shows: "8",
    type: "number",
    alignment: "right",
    styleId: "cs-total"
  }),
  at("E6", {
    content: "=SUM(E2:E5)",
    formula: "=SUM(E2:E5)",
    shows: "726,081",
    type: "number",
    alignment: "right",
    styleId: "cs-total",
    valueFormat: "#,##0"
  }),
  at("F6", {
    content: "=SUM(F2:F5)",
    formula: "=SUM(F2:F5)",
    shows: "31.35",
    type: "number",
    alignment: "right",
    styleId: "cs-total",
    valueFormat: "#,##0.00"
  }),
  at("G6", {
    content: "=AVERAGE(G2:G5)",
    formula: "=AVERAGE(G2:G5)",
    shows: "44.11",
    type: "number",
    alignment: "right",
    styleId: "cs-total",
    valueFormat: "#,##0.00"
  }),

  at("A8", { content: "Scratch — repair before filing", type: "text", alignment: "left" }),
  at("D8", {
    content: "=SUM(#REF!)",
    formula: "=SUM(#REF!)",
    shows: "#REF!",
    type: "number",
    alignment: "right",
    error: "#REF!"
  }),
  at("F8", {
    content: "=F6/eventCount",
    formula: "=F6/eventCount",
    shows: "#NAME?",
    type: "number",
    alignment: "right",
    error: "#NAME?"
  })
];

/** Reads, by the address that does the reading. Parsed out of the formula, never stored. */
const READS: Readonly<Record<string, readonly CellReference[]>> = {
  G3: [
    { address: "E3", shows: "194,224", kind: "spill child", note: "Spill child of E2" },
    { address: "F3", shows: "8.10", kind: "value", note: "Literal number" }
  ],
  G2: [
    { address: "E2", shows: "268,110", kind: "spill child", note: "Spill origin" },
    { address: "F2", shows: "11.40", kind: "value", note: "Literal number" }
  ],
  G6: [
    { address: "G2", shows: "42.52", kind: "formula" },
    { address: "G3", shows: "41.70", kind: "formula" },
    { address: "G4", shows: "42.23", kind: "formula" },
    { address: "G5", shows: "49.97", kind: "formula" }
  ],
  C6: [
    { address: "C2", shows: "1,842,000", kind: "value" },
    { address: "C3", shows: "318,400", kind: "value" },
    { address: "C4", shows: "286,150", kind: "value" },
    { address: "C5", shows: "158,720", kind: "value" }
  ],
  E2: [
    { address: "costModel", shows: "A1:G6", kind: "named range", note: "Named range" }
  ],
  D8: [{ address: "#REF!", shows: "—", kind: "broken", note: "The range was deleted" }],
  F8: [
    { address: "F6", shows: "31.35", kind: "formula" },
    { address: "eventCount", shows: "—", kind: "broken", note: "No such name" }
  ]
};

/** Feeds, from a reverse scan over formulas. There is no persisted dependency graph. */
const FEEDS: Readonly<Record<string, readonly CellReference[]>> = {
  G3: [{ address: "G6", shows: "=AVERAGE(G2:G5)", kind: "formula" }],
  G2: [{ address: "G6", shows: "=AVERAGE(G2:G5)", kind: "formula" }],
  E3: [{ address: "G3", shows: '=IF(E3=0,"",F3*1000000/E3)', kind: "formula" }],
  E2: [
    { address: "E6", shows: "=SUM(E2:E5)", kind: "formula" },
    { address: "G2", shows: '=IF(E2=0,"",F2*1000000/E2)', kind: "formula" }
  ],
  F3: [
    { address: "F6", shows: "=SUM(F2:F5)", kind: "formula" },
    { address: "G3", shows: '=IF(E3=0,"",F3*1000000/E3)', kind: "formula" }
  ],
  C2: [{ address: "C6", shows: "=SUM(C2:C5)", kind: "formula" }],
  F6: [{ address: "F8", shows: "=F6/eventCount", kind: "formula" }]
};

const NAMED_RANGES: readonly NamedRange[] = [
  {
    id: "nr-cost",
    name: "costModel",
    sheet: "Cost model",
    range: "A1:G6",
    referencedByFormulas: 3
  },
  {
    id: "nr-events",
    name: "eventLog",
    sheet: "Cost model",
    range: "A1:M4183",
    referencedByFormulas: 2
  },
  {
    id: "nr-assumptions",
    name: "assumptions",
    sheet: "Cost model",
    range: "A1:C22",
    referencedByFormulas: 1
  },
  {
    id: "nr-avoided",
    name: "avoidedByFeeder",
    sheet: "Cost model",
    range: "E2:E5",
    referencedByFormulas: 0
  }
];

const CHART_CATEGORIES = [
  { key: "north", label: "North" },
  { key: "central", label: "Central" },
  { key: "south", label: "South" },
  { key: "coastal", label: "Coastal" }
] as const;
let chartSequence = 0;
const mockChartId: ChartIdIssuer = (kind) => `sheet-${kind}-${++chartSequence}`;
const categoriesFor = (chartKey: string) =>
  CHART_CATEGORIES.map((category) => ({
    ...category,
    id: `chart-${chartKey}-category-${category.key}`
  }));
const chartValues = (chartKey: string, seriesKey: string, values: readonly number[]) =>
  categoriesFor(chartKey).map((category, index) => ({
    id: `chart-${chartKey}-datum-${category.key}-${seriesKey}`,
    categoryKey: category.key,
    seriesKey,
    value: values[index]
  }));

const MINUTES = createBarChart(
  {
    id: "chart-customer-minutes",
    title: "Customer-minutes by substation",
    source: {
      kind: "spreadsheet-range",
      resourceId: asId<"spreadsheets">(SHEET_ID),
      range: {
        from: { rowId: "row-1", columnId: "column-a" },
        to: { rowId: "row-5", columnId: "column-c" }
      },
      seriesInColumns: true
    },
    data: {
      categories: categoriesFor("minutes"),
      series: [{ id: "chart-series-minutes", key: "minutes", label: "Customer-minutes" }],
      values: chartValues("minutes", "minutes", [1842, 1310, 970, 620])
    },
    layout: "group",
    labels: "value",
    valueFormat: { style: "number", compact: true, maximumFractionDigits: 1 }
  },
  mockChartId
);

const AVOIDED = createPieChart(
  {
    id: "chart-avoided-share",
    title: "Avoided minutes by event",
    source: {
      kind: "spreadsheet-range",
      resourceId: asId<"spreadsheets">(SHEET_ID),
      range: {
        from: { rowId: "row-1", columnId: "column-a" },
        to: { rowId: "row-5", columnId: "column-e" }
      },
      seriesInColumns: true
    },
    data: {
      categories: categoriesFor("avoided"),
      series: [{ id: "chart-series-avoided", key: "avoided", label: "Avoided minutes" }],
      values: chartValues("avoided", "avoided", [480, 360, 250, 140])
    },
    labels: "percent",
    innerRadius: 0.2,
    legend: { visible: true, position: "end" }
  },
  mockChartId
);

const SPEND = createBarChart(
  {
    id: "chart-hardening-spend",
    title: "Hardening spend by feeder",
    source: {
      kind: "spreadsheet-range",
      resourceId: asId<"spreadsheets">(SHEET_ID),
      range: {
        from: { rowId: "row-1", columnId: "column-b" },
        to: { rowId: "row-5", columnId: "column-f" }
      },
      seriesInColumns: true
    },
    data: {
      categories: categoriesFor("spend"),
      series: [{ id: "chart-series-spend", key: "spend", label: "Spend" }],
      values: chartValues("spend", "spend", [4.2, 3.4, 2.8, 1.9])
    },
    orientation: "horizontal",
    layout: "group",
    labels: "value",
    valueFormat: { style: "currency", currency: "USD", compact: true, maximumFractionDigits: 1 }
  },
  mockChartId
);

const analyticForChart = (
  id: string,
  chart: ChartModel,
  variable: string,
  dimensionKey: string,
  measureKey: string
): AnalyticModel => {
  const inputId = `${id}-input`;
  const dimensionId = `${id}-dimension`;
  const dimension: AnalyticListReference = {
    inputId,
    selector: { kind: "column", key: dimensionKey }
  };
  const measure: AnalyticListReference = {
    inputId,
    selector: { kind: "column", key: measureKey }
  };
  const groupId = `${id}-group`;
  const aggregateId = `${id}-aggregate`;
  return {
    id,
    title: chart.title ?? "Analytic",
    definition: {
      inputs: [{ id: inputId, variable }],
      dimensions: [{
        id: dimensionId,
        slot: chart.type === "pie" ? "labels" : "x",
        inputs: [{ id: `${id}-binding`, inputId, values: dimension.selector }],
        steps: [],
        operations: []
      }],
      bridges: [],
      data: {
        from: { kind: "dimension", dimensionId },
        operations: [
          { id: groupId, kind: "group", by: [dimension] },
          {
            id: aggregateId,
            kind: "aggregate",
            input: { kind: "list", list: measure },
            aggregation: "sum",
            as: chart.data.series[0]?.label ?? "Value"
          }
        ],
        outputs: [{
          id: `${id}-output`,
          label: chart.data.series[0]?.label ?? "Value",
          value: { kind: "operation", operationId: aggregateId },
          ...(chart.valueFormat === undefined ? {} : { format: chart.valueFormat })
        }]
      }
    },
    component: { kind: "chart", chart },
    materialization: { state: "ready", issueIds: [] }
  };
};

const MINUTES_ANALYTIC = analyticForChart(
  "analytic-customer-minutes",
  MINUTES,
  "outageCostModel",
  "substation",
  "customerMinutes"
);
const AVOIDED_ANALYTIC = analyticForChart(
  "analytic-avoided-share",
  AVOIDED,
  "outageCostModel",
  "event",
  "avoidedMinutes"
);
const SPEND_ANALYTIC = analyticForChart(
  "analytic-hardening-spend",
  SPEND,
  "outageCostModel",
  "feeder",
  "spend"
);

const OBJECTS: readonly SheetObject[] = [
  {
    id: MINUTES_ANALYTIC.id,
    kind: "Column",
    title: "Customer-minutes by substation",
    sourceRange: "A1:C5",
    anchor: "E9",
    size: { width: 360, height: 220 },
    overlapped: false,
    model: MINUTES_ANALYTIC
  },
  {
    id: AVOIDED_ANALYTIC.id,
    kind: "Pie",
    title: "Avoided minutes by event",
    sourceRange: "A1:E5",
    anchor: "A14",
    size: { width: 420, height: 240 },
    overlapped: true,
    model: AVOIDED_ANALYTIC
  },
  {
    id: SPEND_ANALYTIC.id,
    kind: "Bar",
    title: "Hardening spend by feeder",
    sourceRange: "B1:B5,F1:F5",
    anchor: "A26",
    size: { width: 360, height: 200 },
    overlapped: false,
    model: SPEND_ANALYTIC
  }
];

const SHEET_STYLES: readonly NamedCellStyle[] = [
  {
    id: "cs-header",
    name: "Header",
    weight: 600,
    alignment: "center",
    shorthand: "600 · centered",
    usedByCells: 7
  },
  {
    id: "cs-currency",
    name: "Currency",
    weight: 400,
    alignment: "right",
    valueFormat: "$#,##0.00",
    shorthand: "$#,##0.00",
    usedByCells: 8
  },
  {
    id: "cs-minutes",
    name: "Minutes",
    weight: 400,
    alignment: "right",
    valueFormat: "#,##0",
    shorthand: "#,##0",
    usedByCells: 8
  },
  {
    id: "cs-total",
    name: "Total",
    weight: 600,
    alignment: "right",
    border: "Top rule",
    shorthand: "600 · top border",
    usedByCells: 7
  }
];

export const spreadsheetRecord = (spreadsheetId: string): Read<SpreadsheetRecord> => {
  const record = resourceRecord(spreadsheetId);
  return read({
    id: record.id,
    title: record.name,
    // The model is A1:G6; the extent runs to row 8 because a broken cell still
    // occupies a coordinate. A record that said A1:G6 while Problems names D8
    // would send a reviewer hunting for a bug that is not there.
    usedRange: "A1:G8",
    populatedCells: CELLS.length,
    saved: "All changes saved",
    updated: record.updated
  }, "resource.spreadsheetRecord");
};

export const cellsIn = (spreadsheetId: string): Read<readonly Cell[]> => {
  void spreadsheetId;
  return read(CELLS, "resource.cellsIn");
};

export const cell = (spreadsheetId: string, address: string): Read<Cell | undefined> => {
  void spreadsheetId;
  return read(CELLS.find((candidate) => candidate.address === address), "resource.cell");
};

export const readsOf = (
  spreadsheetId: string,
  address: string
): Read<readonly CellReference[]> => {
  void spreadsheetId;
  return read(READS[address] ?? [], "resource.readsOf");
};

export const feedsOf = (
  spreadsheetId: string,
  address: string
): Read<readonly CellReference[]> => {
  void spreadsheetId;
  return read(FEEDS[address] ?? [], "resource.feedsOf");
};

/** Every cell whose formula cannot resolve, for the whole spreadsheet rather than the selection. */
export const problemsIn = (spreadsheetId: string): Read<readonly CellProblem[]> => {
  void spreadsheetId;
  return read([
    {
      address: "D8",
      error: "#REF!",
      formula: "=SUM(#REF!)",
      explanation: "This formula refers to a range that no longer exists."
    },
    {
      address: "F8",
      error: "#NAME?",
      formula: "=F6/eventCount",
      explanation: "No name in this spreadsheet or this project is called eventCount."
    }
  ], "resource.problemsIn");
};

/** The error at one address, with the formula kept exactly as written so it can be repaired. */
export const errorAt = (
  spreadsheetId: string,
  address: string
): Read<CellProblem | undefined> => {
  void spreadsheetId;
  return read(
    problemsIn(spreadsheetId).current.find((problem) => problem.address === address),
    "resource.errorAt"
  );
};

/** Spill membership for an address. Absent where the cell is part of no spill. */
export const spillAt = (
  spreadsheetId: string,
  address: string
): Read<SpillInfo | undefined> => {
  void spreadsheetId;
  const found = CELLS.find((candidate) => candidate.address === address);
  if (found?.spillOrigin === undefined) return read(undefined, "resource.spillAt");
  return read({
    origin: found.spillOrigin,
    occupied: "E2:E5",
    status: found.address === found.spillOrigin ? "Origin" : "Read-only child",
    originFormula: "=avoidedMinutes(costModel)"
  }, "resource.spillAt");
};

export const namedRangesIn = (spreadsheetId: string): Read<readonly NamedRange[]> => {
  void spreadsheetId;
  return read(NAMED_RANGES, "resource.namedRangesIn");
};

export const namedRange = (spreadsheetId: string, name: string): Read<NamedRange> => {
  void spreadsheetId;
  return read(
    NAMED_RANGES.find((range) => range.name === name) ?? NAMED_RANGES[0],
    "resource.namedRange"
  );
};

export const objectsIn = (spreadsheetId: string): Read<readonly SheetObject[]> => {
  void spreadsheetId;
  return read(OBJECTS, "resource.objectsIn");
};

/** By stable chart id; reordering the object list does not change the result. */
export const chartAt = (spreadsheetId: string, chartId: string): Read<SheetObject | undefined> => {
  void spreadsheetId;
  return read(OBJECTS.find((object) => object.id === chartId), "resource.chartAt");
};

export const printSetup = (spreadsheetId: string): Read<PrintSetup> => {
  void spreadsheetId;
  return read({
    paper: "Letter",
    orientation: "Landscape",
    scale: "Fit to 1 page wide",
    printArea: "A1:G6",
    repeatRows: "1:1",
    repeatColumns: "A:A",
    gridlines: false,
    headings: false
  }, "resource.printSetup");
};

export const sheetStyles = (spreadsheetId: string): Read<readonly NamedCellStyle[]> => {
  void spreadsheetId;
  return read(SHEET_STYLES, "resource.sheetStyles");
};

export const sheetStyle = (styleId: string): Read<NamedCellStyle> =>
  read(
    SHEET_STYLES.find((style) => style.id === styleId) ?? SHEET_STYLES[0],
    "resource.sheetStyle"
  );

/** Two passes over two layers of text — stored formulas, and evaluated values. */
export const findInSheet = (
  spreadsheetId: string,
  query: string
): Read<readonly SheetHit[]> => {
  void spreadsheetId;
  void query;
  return read([
    { id: "gh-1", address: "C1", content: "Customer-minutes lost", layer: "value" },
    { id: "gh-2", address: "E1", content: "Avoided minutes (modelled)", layer: "value" },
    { id: "gh-3", address: "G1", content: "Cost per avoided minute", layer: "value" },
    { id: "gh-4", address: "E2", content: "=avoidedMinutes(costModel)", layer: "formula" }
  ], "resource.findInSheet");
};

/**
 * The selection as a block. `cellsWithContent` against `coordinates` is the pair
 * that matters on a sparse grid — a range can be large and almost empty.
 */
export const rangeSelection = (spreadsheetId: string, a1: string): Read<RangeSelection> => {
  void spreadsheetId;
  void a1;
  return read({
    a1: "A1:G1",
    cellsWithContent: 7,
    coordinates: 7,
    formatting: [
      { label: "Style", value: "Header", mixed: false },
      { label: "Alignment", value: "Mixed", mixed: true },
      { label: "Fill", value: "Mixed", mixed: true }
    ],
    // No sum or average: every cell in the header row is text.
    aggregate: [{ label: "Count", value: "7" }]
  }, "resource.rangeSelection");
};
