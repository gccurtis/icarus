import assert from "node:assert/strict";
import test from "node:test";
import {
  createRichText,
  DEFAULT_CONFIG,
  type RichContent,
} from "../../src/0-platform/rich-text/index.js";
import {
  canonicalizeSnapshot,
} from "../../src/3-capabilities/slides/domain/canonical.js";
import {
  ancestorsOf,
  descendantsOf,
  paintOrder,
  promptSites,
  promptSiteKey,
  siblingsOf,
  unreachableElementIds,
} from "../../src/3-capabilities/slides/domain/elements.js";
import {
  SlideOperationError,
  SlideStyleReferenceError,
  SlideTokenReferenceError,
  SlideValidationError,
} from "../../src/3-capabilities/slides/domain/errors.js";
import {
  collectSlideIdentities,
  computeSlideIdentityTransitions,
} from "../../src/3-capabilities/slides/domain/identities.js";
import { deckOutline } from "../../src/3-capabilities/slides/domain/outline.js";
import type {
  DeckChangeSet,
  DeckSnapshot,
  ElementContainerRef,
  Layout,
  Master,
  Slide,
  SlideElement,
  SlideLimits,
  SlideOperation,
  SlideTable,
  TextElement,
} from "../../src/3-capabilities/slides/domain/model.js";
import {
  resolveBackground,
  resolveColor,
  resolveElementFrame,
  resolveSlidePlan,
  slotBindings,
  unfilledSlots,
} from "../../src/3-capabilities/slides/domain/presentation.js";
import { canRebase } from "../../src/3-capabilities/slides/domain/rebase.js";
import {
  applyOperations,
  computeTouchedIds,
  resolveSlideStyle,
} from "../../src/3-capabilities/slides/domain/reducer.js";
import { invertOperations } from "../../src/3-capabilities/slides/domain/inverses.js";
import { validateSnapshot } from "../../src/3-capabilities/slides/domain/validation.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const NORMAL_STYLE = "slide-style-normal";
const ACCENT_STYLE = "slide-style-accent";
const INK_TOKEN = "token-ink";
const PAPER_TOKEN = "token-paper";
const BODY_FONT_TOKEN = "token-body-font";
const BASE_SIZE_TOKEN = "token-base-size";

const MASTER_ID = "master-1";
const LAYOUT_ID = "layout-1";
const SLIDE_ID = "slide-1";
const TITLE_SLOT = "slot-title";
const BODY_SLOT = "slot-body";

const SLIDE: ElementContainerRef = { kind: "slide", slideId: SLIDE_ID };
const LAYOUT: ElementContainerRef = { kind: "layout", layoutId: LAYOUT_ID };
const MASTER: ElementContainerRef = { kind: "master", masterId: MASTER_ID };

const LIMITS: SlideLimits = {
  maxSlidesPerDeck: 200,
  maxElementsPerContainer: 200,
  maxMastersPerDeck: 20,
  maxLayoutsPerDeck: 50,
  maxSlotsPerLayout: 20,
  maxStylesPerDeck: 100,
  maxTokensPerTheme: 100,
  maxGroupDepth: 8,
  maxTableRows: 100,
  maxTableColumns: 50,
};

const richText = () => createRichText(DEFAULT_CONFIG, new CapturingLogger());

const content = (atomId: string, text: string): RichContent => ({
  atoms: [{ id: atomId, kind: "text", text }],
  marks: [],
});

const frame = (xPt = 10, yPt = 10, widthPt = 100, heightPt = 50) => ({
  xPt,
  yPt,
  widthPt,
  heightPt,
});

const textElement = (
  id: string,
  zIndex: number,
  text = "Hello",
  parentGroupId?: string,
): TextElement => ({
  id,
  kind: "text",
  zIndex,
  placement: { kind: "free", frame: frame() },
  locked: false,
  hidden: false,
  body: { kind: "rich", content: content(`${id}-atom`, text) },
  ...(parentGroupId === undefined ? {} : { parentGroupId }),
});

const groupElement = (id: string, zIndex: number, parentGroupId?: string): SlideElement => ({
  id,
  kind: "group",
  zIndex,
  placement: { kind: "free", frame: frame() },
  locked: false,
  hidden: false,
  ...(parentGroupId === undefined ? {} : { parentGroupId }),
});

const table = (id: string): SlideTable => ({
  id: `${id}-table`,
  columns: [
    { id: `${id}-c1`, width: { kind: "auto" } },
    { id: `${id}-c2`, width: { kind: "fixed", widthPt: 80 } },
  ],
  rows: [
    { id: `${id}-r1`, header: true },
    { id: `${id}-r2`, header: false },
  ],
  cells: [
    cell(`${id}-r1c1`, `${id}-r1`, `${id}-c1`, "A"),
    cell(`${id}-r1c2`, `${id}-r1`, `${id}-c2`, "B"),
    cell(`${id}-r2c1`, `${id}-r2`, `${id}-c1`, "C"),
    cell(`${id}-r2c2`, `${id}-r2`, `${id}-c2`, "D"),
  ],
  merges: [],
});

const cell = (id: string, rowId: string, columnId: string, text: string) => ({
  id,
  rowId,
  columnId,
  body: { kind: "rich" as const, content: content(`${id}-atom`, text) },
  verticalAlign: "top" as const,
});

const tableElement = (id: string, zIndex: number): SlideElement => ({
  id,
  kind: "table",
  zIndex,
  placement: { kind: "free", frame: frame() },
  locked: false,
  hidden: false,
  table: table(id),
});

const master = (): Master => ({
  id: MASTER_ID,
  name: "Default Master",
  background: { kind: "solid", color: { kind: "token", tokenId: PAPER_TOKEN } },
  elements: {},
});

const layout = (): Layout => ({
  id: LAYOUT_ID,
  name: "Title and Body",
  masterId: MASTER_ID,
  elements: {},
  slots: {
    [TITLE_SLOT]: {
      id: TITLE_SLOT,
      name: "Title",
      frame: frame(40, 40, 600, 80),
      accepts: ["text"],
    },
    [BODY_SLOT]: {
      id: BODY_SLOT,
      name: "Body",
      frame: frame(40, 160, 600, 300),
      accepts: [],
    },
  },
});

const slide = (elements: Record<string, SlideElement> = {}): Slide => ({
  id: SLIDE_ID,
  layoutId: LAYOUT_ID,
  notes: content("notes-atom", "Speaker notes"),
  elements,
});

const bodySite = (elementId: string, container: ElementContainerRef = SLIDE) =>
  ({ kind: "element-body", container, elementId }) as const;

const blankSnapshot = (): DeckSnapshot => ({
  representationVersion: 1,
  revision: 0,
  title: "Domain test deck",
  lifecycle: "active",
  canvas: { widthPt: 720, heightPt: 405 },
  theme: {
    name: "Default",
    tokens: {
      [INK_TOKEN]: { id: INK_TOKEN, kind: "color", name: "Ink", value: "#111111" },
      [PAPER_TOKEN]: { id: PAPER_TOKEN, kind: "color", name: "Paper", value: "#ffffff" },
      [BODY_FONT_TOKEN]: {
        id: BODY_FONT_TOKEN,
        kind: "font",
        name: "Body",
        family: "Inter",
      },
      [BASE_SIZE_TOKEN]: {
        id: BASE_SIZE_TOKEN,
        kind: "length",
        name: "Base size",
        valuePt: 18,
      },
    },
    palette: {
      background: { kind: "token", tokenId: PAPER_TOKEN },
      surface: { kind: "literal", value: "#f5f5f5" },
      text: { kind: "token", tokenId: INK_TOKEN },
      accent: { kind: "literal", value: "#0055ff" },
    },
    typography: {
      headingFontFamily: { kind: "token", tokenId: BODY_FONT_TOKEN },
      bodyFontFamily: { kind: "token", tokenId: BODY_FONT_TOKEN },
      baseFontSizePt: { kind: "token", tokenId: BASE_SIZE_TOKEN },
    },
  },
  styles: {
    defaultStyleIdByElementKind: {
      group: NORMAL_STYLE,
      text: NORMAL_STYLE,
      table: NORMAL_STYLE,
      chart: NORMAL_STYLE,
      image: NORMAL_STYLE,
      geometry: NORMAL_STYLE,
      line: NORMAL_STYLE,
    },
    styles: [
      {
        id: NORMAL_STYLE,
        name: "Normal",
        systemRole: "normal",
        text: { fontSize: 1, color: "#111111" },
        box: { paddingPt: 4 },
      },
      {
        id: ACCENT_STYLE,
        name: "Accent",
        basedOnStyleId: NORMAL_STYLE,
        text: { fontWeight: 700 },
        box: { fill: { kind: "solid", color: { kind: "token", tokenId: INK_TOKEN } } },
      },
    ],
  },
  masters: { [MASTER_ID]: master() },
  layouts: { [LAYOUT_ID]: layout() },
  slideOrder: [SLIDE_ID],
  slides: { [SLIDE_ID]: slide() },
});

const withElements = (...elements: SlideElement[]): DeckSnapshot => {
  const snapshot = blankSnapshot();
  const record: Record<string, SlideElement> = {};
  for (const element of elements) record[element.id] = element;
  snapshot.slides[SLIDE_ID].elements = record;
  return snapshot;
};

/** Apply, then apply the inverse, and assert canonical equality with the source. */
const assertRoundTrip = (source: DeckSnapshot, operations: SlideOperation[]): void => {
  const runtime = richText();
  const applied = applyOperations(source, operations, runtime, LIMITS);
  const restored = applyOperations(applied.snapshot, applied.inverse, runtime, LIMITS);
  assert.deepEqual(
    Buffer.from(canonicalizeSnapshot(restored.snapshot)).toString("utf8"),
    Buffer.from(canonicalizeSnapshot(source)).toString("utf8"),
  );
};

const zOrder = (snapshot: DeckSnapshot, parentGroupId?: string): string[] =>
  siblingsOf(snapshot.slides[SLIDE_ID].elements, parentGroupId).map(
    (element) => `${element.id}@${element.zIndex}`,
  );

// ── Validation ───────────────────────────────────────────────────────────

test("a blank Deck satisfies every snapshot invariant", () => {
  const result = validateSnapshot(blankSnapshot(), richText(), LIMITS);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ok, true);
});

test("validation rejects a Deck with no Slide, no Master, or no protected Normal style", () => {
  const runtime = richText();

  const noSlides = blankSnapshot();
  noSlides.slideOrder = [];
  noSlides.slides = {};
  assert.ok(
    validateSnapshot(noSlides, runtime, LIMITS).diagnostics.includes(
      "a Deck must have at least one Slide",
    ),
  );

  const noMasters = blankSnapshot();
  noMasters.masters = {};
  const masterDiagnostics = validateSnapshot(noMasters, runtime, LIMITS).diagnostics;
  assert.ok(masterDiagnostics.includes("a Deck must have at least one Master"));
  assert.ok(masterDiagnostics.some((entry) => entry.includes("references missing Master")));

  const noNormal = blankSnapshot();
  noNormal.styles.styles = noNormal.styles.styles.map((style) => ({
    ...style,
    systemRole: undefined,
  }));
  assert.ok(
    validateSnapshot(noNormal, runtime, LIMITS).diagnostics.includes(
      "exactly one normal Style is required",
    ),
  );
});

test("validation rejects a token reference of the wrong kind and a missing token", () => {
  const runtime = richText();

  const wrongKind = blankSnapshot();
  wrongKind.theme.palette.text = { kind: "token", tokenId: BASE_SIZE_TOKEN };
  assert.ok(
    validateSnapshot(wrongKind, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("of kind length, expected color"),
    ),
  );

  const missing = blankSnapshot();
  missing.theme.palette.text = { kind: "token", tokenId: "token-absent" };
  assert.ok(
    validateSnapshot(missing, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("references missing token token-absent"),
    ),
  );
});

test("validation rejects non-contiguous sibling z-order and an empty Group", () => {
  const runtime = richText();

  const gapped = withElements(textElement("a", 0), textElement("b", 5));
  assert.ok(
    validateSnapshot(gapped, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("z-order must be unique and contiguous"),
    ),
  );

  const empty = withElements(groupElement("g", 0));
  assert.ok(
    validateSnapshot(empty, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("group g has no members"),
    ),
  );
});

test("a group parent cycle is rejected, and the helpers survive one", () => {
  // Regression: checking `ancestorsOf(x).includes(x)` can never fire, because
  // the ancestor walk stops when it revisits its own start. A cycle is instead
  // a set unreachable from the container root.
  const snapshot = withElements(groupElement("a", 0), groupElement("b", 0));
  snapshot.slides[SLIDE_ID].elements.a.parentGroupId = "b";
  snapshot.slides[SLIDE_ID].elements.b.parentGroupId = "a";

  assert.deepEqual(ancestorsOf(snapshot.slides[SLIDE_ID].elements, "a").map((e) => e.id), ["b"]);
  assert.deepEqual(unreachableElementIds(snapshot.slides[SLIDE_ID].elements), ["a", "b"]);

  const diagnostics = validateSnapshot(snapshot, richText(), LIMITS).diagnostics;
  assert.ok(diagnostics.some((entry) => entry.includes("element a is not reachable")));
  assert.ok(diagnostics.some((entry) => entry.includes("element b is not reachable")));

  // Regression: an unguarded walk overflows the stack instead of terminating.
  assert.deepEqual(
    descendantsOf(snapshot.slides[SLIDE_ID].elements, "a").map((element) => element.id),
    ["b"],
  );
});

// Group membership being acyclic is load-bearing: a cycle makes every downward
// walk non-terminating, so no operation may be able to produce one. There are
// exactly five operations that write a parent pointer — element.insert,
// element.replace, element.reorder, element.group, element.ungroup — plus three
// that take a whole element record: slide.insert, master.insert, layout.insert.
// Every one of them is covered below.

/**
 * outer[ inner[ leaf, twig ], keep ], free
 *
 * Both groups carry two members, so moving one out never empties a group —
 * that is a separate rule, and it would otherwise mask the cycle assertions.
 */
const nested = (): DeckSnapshot =>
  withElements(
    groupElement("outer", 0),
    groupElement("inner", 0, "outer"),
    textElement("keep", 1, "Keep", "outer"),
    textElement("leaf", 0, "Leaf", "inner"),
    textElement("twig", 1, "Twig", "inner"),
    textElement("free", 1),
  );

const refuses = (source: DeckSnapshot, operations: SlideOperation[]): void => {
  assert.throws(
    () => applyOperations(source, operations, richText(), LIMITS),
    (error: unknown) =>
      error instanceof SlideOperationError || error instanceof SlideValidationError,
  );
};

/** Cyclic element record, built by hand — no operation can produce this. */
const cyclicElements = (): Record<string, SlideElement> => {
  const a = groupElement("cyc-a", 0);
  const b = groupElement("cyc-b", 0);
  a.parentGroupId = "cyc-b";
  b.parentGroupId = "cyc-a";
  return { "cyc-a": a, "cyc-b": b };
};

test("element.insert cannot create a cycle", () => {
  const source = nested();
  // Self-parent: the parent lookup runs before the element exists, so it fails.
  const selfParented = { ...textElement("novel", 0), parentGroupId: "novel" };
  refuses(source, [{ type: "element.insert", container: SLIDE, element: selfParented }]);
  // A non-group parent is refused, which is what keeps the forest a forest.
  refuses(source, [
    {
      type: "element.insert",
      container: SLIDE,
      element: { ...textElement("novel", 0), parentGroupId: "leaf" },
    },
  ]);
});

test("element.replace cannot change parentage at all", () => {
  const source = nested();
  const applied = applyOperations(
    source,
    [
      {
        type: "element.replace",
        container: SLIDE,
        // The replacement claims a different parent; replace must ignore it.
        element: { ...textElement("leaf", 0, "Rewritten"), parentGroupId: "outer" },
      },
    ],
    richText(),
    LIMITS,
  );
  assert.equal(applied.snapshot.slides[SLIDE_ID].elements.leaf.parentGroupId, "inner");
  assert.deepEqual(unreachableElementIds(applied.snapshot.slides[SLIDE_ID].elements), []);
});

test("element.reorder cannot create a cycle, in one step or two", () => {
  const source = nested();
  // Beneath itself.
  refuses(source, [
    { type: "element.reorder", container: SLIDE, elementId: "outer", parentGroupId: "outer", zIndex: 0 },
  ]);
  // Beneath its own descendant.
  refuses(source, [
    { type: "element.reorder", container: SLIDE, elementId: "outer", parentGroupId: "inner", zIndex: 0 },
  ]);
  // Beneath a non-group.
  refuses(source, [
    { type: "element.reorder", container: SLIDE, elementId: "free", parentGroupId: "leaf", zIndex: 0 },
  ]);
  // Two legal-looking steps that would close a cycle: the second must refuse,
  // because the first has already made `free` an ancestor of nothing but the
  // guard is evaluated against the state the first step produced.
  refuses(source, [
    { type: "element.reorder", container: SLIDE, elementId: "inner", zIndex: 2 },
    { type: "element.reorder", container: SLIDE, elementId: "inner", parentGroupId: "inner", zIndex: 0 },
  ]);
});

test("element.group cannot create a cycle", () => {
  const source = nested();
  // Naming the same member twice corrupts sibling numbering. End-of-batch
  // validation would catch the corruption, so this asserts the specific guard
  // rather than merely that the batch is refused — otherwise the guard could be
  // deleted without any test noticing.
  assert.throws(
    () =>
      applyOperations(
        source,
        [
          {
            type: "element.group",
            container: SLIDE,
            group: groupElement("g", 0),
            memberIds: ["free", "free"],
          },
        ],
        richText(),
        LIMITS,
      ),
    (error: unknown) =>
      error instanceof SlideOperationError && /same member twice/.test((error as Error).message),
  );
  // A member that contains another member sits at a different depth, so the
  // shared-parent rule refuses it. This is what makes grouping cycle-proof.
  refuses(source, [
    {
      type: "element.group",
      container: SLIDE,
      group: groupElement("g", 0),
      memberIds: ["inner", "leaf"],
    },
  ]);
  // The Group cannot be its own member: its ID does not exist yet.
  refuses(source, [
    {
      type: "element.group",
      container: SLIDE,
      group: groupElement("g", 0),
      memberIds: ["g"],
    },
  ]);
});

test("element.ungroup only ever moves members upward", () => {
  const source = nested();
  const applied = applyOperations(
    source,
    [{ type: "element.ungroup", container: SLIDE, groupId: "inner" }],
    richText(),
    LIMITS,
  );
  assert.equal(applied.snapshot.slides[SLIDE_ID].elements.leaf.parentGroupId, "outer");
  assert.deepEqual(unreachableElementIds(applied.snapshot.slides[SLIDE_ID].elements), []);
});

test("a container insert refuses a cyclic or malformed element record", () => {
  const source = blankSnapshot();

  refuses(source, [
    {
      type: "slide.insert",
      slide: { ...slide(), id: "slide-2", elements: cyclicElements() },
      afterSlideId: SLIDE_ID,
    },
  ]);
  refuses(source, [
    {
      type: "master.insert",
      master: { ...master(), id: "master-2", elements: cyclicElements() },
    },
  ]);
  refuses(source, [
    {
      type: "layout.insert",
      layout: { ...layout(), id: "layout-2", slots: {}, elements: cyclicElements() },
    },
  ]);

  // A dangling parent pointer is refused by the same guard.
  refuses(source, [
    {
      type: "slide.insert",
      slide: {
        ...slide(),
        id: "slide-2",
        elements: { orphan: { ...textElement("orphan", 0), parentGroupId: "absent" } },
      },
      afterSlideId: SLIDE_ID,
    },
  ]);
});

test("a cycle is refused at the operation, not merely at end-of-batch validation", () => {
  // The distinction matters: end-of-batch validation runs after every operation
  // has been applied, and a downward walk over a cycle does not terminate. The
  // guard has to fire before anything walks the structure.
  const source = blankSnapshot();
  assert.throws(
    () =>
      applyOperations(
        source,
        [
          {
            type: "slide.insert",
            slide: { ...slide(), id: "slide-2", elements: cyclicElements() },
            afterSlideId: SLIDE_ID,
          },
        ],
        richText(),
        LIMITS,
      ),
    (error: unknown) =>
      error instanceof SlideOperationError && /group cycle/.test((error as Error).message),
  );
});

test("no legal operation sequence leaves an unreachable element", () => {
  // A sweep over every structural operation, asserting the forest invariant
  // holds after each one rather than only at the end.
  const source = nested();
  const runtime = richText();
  const sequences: SlideOperation[][] = [
    [{ type: "element.insert", container: SLIDE, element: textElement("added", 2) }],
    [{ type: "element.insert", container: SLIDE, element: textElement("added", 0, "In", "inner") }],
    [{ type: "element.reorder", container: SLIDE, elementId: "free", parentGroupId: "inner", zIndex: 0 }],
    [{ type: "element.reorder", container: SLIDE, elementId: "leaf", zIndex: 0 }],
    [{ type: "element.ungroup", container: SLIDE, groupId: "inner" }],
    [{ type: "element.delete", container: SLIDE, elementId: "inner" }],
    [
      { type: "element.reorder", container: SLIDE, elementId: "leaf", zIndex: 0 },
      { type: "element.group", container: SLIDE, group: groupElement("g", 0), memberIds: ["leaf", "free"] },
    ],
  ];

  for (const operations of sequences) {
    const applied = applyOperations(source, operations, runtime, LIMITS);
    for (const container of [SLIDE, MASTER, LAYOUT]) {
      const elements =
        container.kind === "slide"
          ? applied.snapshot.slides[SLIDE_ID].elements
          : container.kind === "master"
            ? applied.snapshot.masters[MASTER_ID].elements
            : applied.snapshot.layouts[LAYOUT_ID].elements;
      assert.deepEqual(unreachableElementIds(elements), []);
    }
  }
});

test("a prompt source is live in all three planes", () => {
  const runtime = richText();
  const prompted = (id: string, outputId: string) => ({
    ...textElement(id, 0),
    body: { kind: "prompt" as const, output: { outputId, appliedRevision: 3 } },
  });

  const snapshot = withElements(prompted("on-slide", "output-1"));
  snapshot.masters[MASTER_ID].elements = { "on-master": prompted("on-master", "output-2") };
  snapshot.layouts[LAYOUT_ID].elements = { "on-layout": prompted("on-layout", "output-3") };

  assert.deepEqual(validateSnapshot(snapshot, runtime, LIMITS).diagnostics, []);
  assert.deepEqual(
    promptSites(snapshot).map((entry) => `${entry.site.container.kind}:${entry.outputId}`),
    ["master:output-2", "layout:output-3", "slide:output-1"],
  );
});

test("slide notes are authored only and hold Rich Content directly", () => {
  const snapshot = blankSnapshot();
  assert.deepEqual(snapshot.slides[SLIDE_ID].notes, content("notes-atom", "Speaker notes"));
  // Notes are the author's own aside, so they are not a prompt site at all.
  assert.deepEqual(promptSites(snapshot), []);
});

test("one Derived Output may not be bound at two prompt sites", () => {
  const shared = { outputId: "output-shared", appliedRevision: 2 };
  const snapshot = withElements(
    { ...textElement("one", 0), body: { kind: "prompt", output: shared } },
    { ...textElement("two", 1), body: { kind: "prompt", output: shared } },
  );
  assert.ok(
    validateSnapshot(snapshot, richText(), LIMITS).diagnostics.some((entry) =>
      entry.includes("is bound at both"),
    ),
  );
});

test("a slot binding must respect what the slot accepts, and only Slides may bind", () => {
  const runtime = richText();

  const wrongKind = withElements({
    ...tableElement("t", 0),
    placement: { kind: "slot", slotId: TITLE_SLOT },
  });
  assert.ok(
    validateSnapshot(wrongKind, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("may not bind slot"),
    ),
  );

  const twoBindings = withElements(
    { ...textElement("a", 0), placement: { kind: "slot", slotId: TITLE_SLOT } },
    { ...textElement("b", 1), placement: { kind: "slot", slotId: TITLE_SLOT } },
  );
  assert.ok(
    validateSnapshot(twoBindings, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("binds slot"),
    ),
  );

  const boundInLayout = blankSnapshot();
  boundInLayout.layouts[LAYOUT_ID].elements = {
    stray: { ...textElement("stray", 0), placement: { kind: "slot", slotId: TITLE_SLOT } },
  };
  assert.ok(
    validateSnapshot(boundInLayout, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("may not bind a slot outside a Slide"),
    ),
  );
});

test("a table must be dense and its merges must not overlap", () => {
  const runtime = richText();

  const sparse = withElements(tableElement("t", 0));
  const sparseTable = (sparse.slides[SLIDE_ID].elements.t as { table: SlideTable }).table;
  sparseTable.cells = sparseTable.cells.slice(0, 3);
  assert.ok(
    validateSnapshot(sparse, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("must hold one cell per row and column"),
    ),
  );

  const overlapping = withElements(tableElement("t", 0));
  const overlappingTable = (overlapping.slides[SLIDE_ID].elements.t as { table: SlideTable })
    .table;
  overlappingTable.merges = [
    { id: "m1", rootCellId: "t-r1c1", coveredCellIds: ["t-r1c2"] },
    { id: "m2", rootCellId: "t-r2c1", coveredCellIds: ["t-r1c2"] },
  ];
  assert.ok(
    validateSnapshot(overlapping, runtime, LIMITS).diagnostics.some((entry) =>
      entry.includes("covered by more than one merge"),
    ),
  );
});

// ── Reducer: exact inverses ──────────────────────────────────────────────

test("deck, canvas and theme edits invert exactly", () => {
  const source = blankSnapshot();
  assertRoundTrip(source, [{ type: "deck.rename", title: "Renamed" }]);
  assertRoundTrip(source, [{ type: "deck.set-lifecycle", lifecycle: "archived" }]);
  assertRoundTrip(source, [
    { type: "canvas.set", canvas: { widthPt: 960, heightPt: 540 } },
  ]);
  assertRoundTrip(source, [{ type: "theme.rename", name: "Renamed theme" }]);
  assertRoundTrip(source, [
    {
      type: "theme.set-palette",
      palette: {
        background: { kind: "literal", value: "#000000" },
        surface: { kind: "literal", value: "#111111" },
        text: { kind: "literal", value: "#eeeeee" },
        accent: { kind: "literal", value: "#ff0055" },
      },
    },
  ]);
});

test("token create, update and delete invert exactly, and delete retargets references", () => {
  const source = blankSnapshot();
  const runtime = richText();

  assertRoundTrip(source, [
    {
      type: "token.create",
      token: { id: "token-new", kind: "color", name: "New", value: "#123456" },
    },
  ]);
  assertRoundTrip(source, [
    {
      type: "token.update",
      tokenId: INK_TOKEN,
      token: { id: INK_TOKEN, kind: "color", name: "Ink", value: "#000000" },
    },
  ]);

  const deleted = applyOperations(
    source,
    [{ type: "token.delete", tokenId: INK_TOKEN, replacementTokenId: PAPER_TOKEN }],
    runtime,
    LIMITS,
  );
  assert.equal(deleted.snapshot.theme.tokens[INK_TOKEN], undefined);
  assert.deepEqual(deleted.snapshot.theme.palette.text, {
    kind: "token",
    tokenId: PAPER_TOKEN,
  });
  const accentBox = deleted.snapshot.styles.styles.find((s) => s.id === ACCENT_STYLE)?.box;
  assert.deepEqual(accentBox?.fill, {
    kind: "solid",
    color: { kind: "token", tokenId: PAPER_TOKEN },
  });

  assertRoundTrip(source, [
    { type: "token.delete", tokenId: INK_TOKEN, replacementTokenId: PAPER_TOKEN },
  ]);
});

test("a token may only be replaced by one of the same kind", () => {
  assert.throws(
    () =>
      applyOperations(
        blankSnapshot(),
        [{ type: "token.delete", tokenId: INK_TOKEN, replacementTokenId: BASE_SIZE_TOKEN }],
        richText(),
        LIMITS,
      ),
    SlideTokenReferenceError,
  );
});

test("style create, update, set-default and delete invert exactly", () => {
  const source = withElements({ ...textElement("styled", 0), styleId: ACCENT_STYLE });

  assertRoundTrip(source, [
    {
      type: "style.create",
      style: { id: "slide-style-extra", name: "Extra", text: { italic: true } },
    },
  ]);
  assertRoundTrip(source, [
    {
      type: "style.update",
      styleId: ACCENT_STYLE,
      style: { id: ACCENT_STYLE, name: "Accent renamed", text: { fontWeight: 900 } },
    },
  ]);
  assertRoundTrip(source, [
    { type: "style.set-default", elementKind: "text", styleId: ACCENT_STYLE },
  ]);
  assertRoundTrip(source, [
    { type: "style.delete", styleId: ACCENT_STYLE, replacementStyleId: NORMAL_STYLE },
  ]);

  const deleted = applyOperations(
    source,
    [{ type: "style.delete", styleId: ACCENT_STYLE, replacementStyleId: NORMAL_STYLE }],
    richText(),
    LIMITS,
  );
  assert.equal(deleted.snapshot.slides[SLIDE_ID].elements.styled.styleId, NORMAL_STYLE);
});

test("an unknown style reference is refused rather than silently dropped", () => {
  assert.throws(
    () =>
      applyOperations(
        withElements(textElement("a", 0)),
        [
          {
            type: "element.set-style",
            container: SLIDE,
            elementId: "a",
            styleId: "slide-style-absent",
          },
        ],
        richText(),
        LIMITS,
      ),
    SlideStyleReferenceError,
  );
});

test("Master and Layout lifecycle operations invert exactly, reassigning dependants", () => {
  const source = blankSnapshot();
  source.masters["master-2"] = { ...master(), id: "master-2", name: "Second" };
  source.layouts["layout-2"] = { ...layout(), id: "layout-2", name: "Second", slots: {} };

  assertRoundTrip(source, [{ type: "master.rename", masterId: MASTER_ID, name: "Renamed" }]);
  assertRoundTrip(source, [
    {
      type: "master.set-background",
      masterId: MASTER_ID,
      background: { kind: "solid", color: { kind: "literal", value: "#ff0000" } },
    },
  ]);
  assertRoundTrip(source, [
    { type: "master.delete", masterId: MASTER_ID, replacementMasterId: "master-2" },
  ]);
  assertRoundTrip(source, [{ type: "layout.rename", layoutId: LAYOUT_ID, name: "Renamed" }]);
  assertRoundTrip(source, [
    { type: "layout.set-master", layoutId: LAYOUT_ID, masterId: "master-2" },
  ]);
  assertRoundTrip(source, [
    { type: "layout.delete", layoutId: LAYOUT_ID, replacementLayoutId: "layout-2" },
  ]);

  const deletedMaster = applyOperations(
    source,
    [{ type: "master.delete", masterId: MASTER_ID, replacementMasterId: "master-2" }],
    richText(),
    LIMITS,
  );
  assert.equal(deletedMaster.snapshot.layouts[LAYOUT_ID].masterId, "master-2");
});

test("slot edits invert exactly and deleting a slot leaves its binding dangling", () => {
  const source = withElements({
    ...textElement("bound", 0),
    placement: { kind: "slot", slotId: BODY_SLOT },
  });

  assertRoundTrip(source, [
    {
      type: "slot.insert",
      layoutId: LAYOUT_ID,
      slot: { id: "slot-extra", name: "Extra", frame: frame(), accepts: [] },
    },
  ]);
  assertRoundTrip(source, [
    {
      type: "slot.update",
      layoutId: LAYOUT_ID,
      slot: { id: BODY_SLOT, name: "Body", frame: frame(0, 0, 10, 10), accepts: [] },
    },
  ]);
  assertRoundTrip(source, [{ type: "slot.delete", layoutId: LAYOUT_ID, slotId: BODY_SLOT }]);

  // A dangling binding stays valid; the projection reports it.
  const deleted = applyOperations(
    source,
    [{ type: "slot.delete", layoutId: LAYOUT_ID, slotId: BODY_SLOT }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(
    deleted.snapshot.slides[SLIDE_ID].elements.bound.placement,
    { kind: "slot", slotId: BODY_SLOT },
  );
  assert.deepEqual(resolveSlidePlan(deleted.snapshot, SLIDE_ID)?.danglingSlotIds, [BODY_SLOT]);
});

test("slide insert, move and delete invert exactly, restoring order position", () => {
  const source = blankSnapshot();
  source.slides["slide-2"] = { ...slide(), id: "slide-2" };
  source.slides["slide-3"] = { ...slide(), id: "slide-3" };
  source.slideOrder = [SLIDE_ID, "slide-2", "slide-3"];

  assertRoundTrip(source, [
    { type: "slide.insert", slide: { ...slide(), id: "slide-4" }, afterSlideId: SLIDE_ID },
  ]);
  assertRoundTrip(source, [{ type: "slide.move", slideId: "slide-2", afterSlideId: "slide-3" }]);
  assertRoundTrip(source, [{ type: "slide.move", slideId: "slide-3" }]);
  assertRoundTrip(source, [{ type: "slide.delete", slideId: "slide-2" }]);

  const moved = applyOperations(
    source,
    [{ type: "slide.move", slideId: "slide-3" }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(moved.snapshot.slideOrder, ["slide-3", SLIDE_ID, "slide-2"]);
});

// ── z-order ──────────────────────────────────────────────────────────────

test("inserting an element opens a slot and keeps sibling z-order contiguous", () => {
  const source = withElements(textElement("a", 0), textElement("b", 1), textElement("c", 2));
  const applied = applyOperations(
    source,
    [{ type: "element.insert", container: SLIDE, element: textElement("mid", 1) }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(zOrder(applied.snapshot), ["a@0", "mid@1", "b@2", "c@3"]);
  assertRoundTrip(source, [
    { type: "element.insert", container: SLIDE, element: textElement("mid", 1) },
  ]);
});

test("deleting an element closes the gap and its inverse restores the exact index", () => {
  const source = withElements(textElement("a", 0), textElement("b", 1), textElement("c", 2));
  const applied = applyOperations(
    source,
    [{ type: "element.delete", container: SLIDE, elementId: "b" }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(zOrder(applied.snapshot), ["a@0", "c@1"]);
  assertRoundTrip(source, [{ type: "element.delete", container: SLIDE, elementId: "b" }]);
});

test("reordering within and between parents invert exactly", () => {
  // The Group keeps two members so that moving one out does not empty it —
  // an empty Group is a validation error, not a reachable state.
  const source = withElements(
    groupElement("g", 0),
    textElement("inside", 0, "Inside", "g"),
    textElement("stays", 1, "Stays", "g"),
    textElement("a", 1),
    textElement("b", 2),
  );

  assertRoundTrip(source, [
    { type: "element.reorder", container: SLIDE, elementId: "b", zIndex: 0 },
  ]);
  assertRoundTrip(source, [
    { type: "element.reorder", container: SLIDE, elementId: "a", parentGroupId: "g", zIndex: 0 },
  ]);
  assertRoundTrip(source, [
    { type: "element.reorder", container: SLIDE, elementId: "inside", zIndex: 2 },
  ]);

  const moved = applyOperations(
    source,
    [{ type: "element.reorder", container: SLIDE, elementId: "b", zIndex: 0 }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(zOrder(moved.snapshot), ["b@0", "g@1", "a@2"]);
});

test("an element cannot be reordered beneath itself", () => {
  const source = withElements(
    groupElement("outer", 0),
    groupElement("inner", 0, "outer"),
    textElement("leaf", 0, "Leaf", "inner"),
  );
  assert.throws(
    () =>
      applyOperations(
        source,
        [
          {
            type: "element.reorder",
            container: SLIDE,
            elementId: "outer",
            parentGroupId: "inner",
            zIndex: 0,
          },
        ],
        richText(),
        LIMITS,
      ),
    SlideOperationError,
  );
});

test("grouping interleaved members inverts exactly, restoring their original indices", () => {
  // The risky case: ungrouping returns members as a contiguous run, which is
  // not where they were. The inverse has to carry explicit reorders.
  const source = withElements(
    textElement("a", 0),
    textElement("m1", 1),
    textElement("b", 2),
    textElement("m2", 3),
    textElement("c", 4),
  );

  const applied = applyOperations(
    source,
    [
      {
        type: "element.group",
        container: SLIDE,
        group: groupElement("g", 0),
        memberIds: ["m1", "m2"],
      },
    ],
    richText(),
    LIMITS,
  );
  // The Group takes the position of its lowest member.
  assert.deepEqual(zOrder(applied.snapshot), ["a@0", "g@1", "b@2", "c@3"]);
  assert.deepEqual(zOrder(applied.snapshot, "g"), ["m1@0", "m2@1"]);

  assertRoundTrip(source, [
    {
      type: "element.group",
      container: SLIDE,
      group: groupElement("g", 0),
      memberIds: ["m1", "m2"],
    },
  ]);
});

test("ungrouping inverts exactly and members land where the Group was", () => {
  const source = withElements(
    textElement("a", 0),
    groupElement("g", 1),
    textElement("m1", 0, "M1", "g"),
    textElement("m2", 1, "M2", "g"),
    textElement("b", 2),
  );

  const applied = applyOperations(
    source,
    [{ type: "element.ungroup", container: SLIDE, groupId: "g" }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(zOrder(applied.snapshot), ["a@0", "m1@1", "m2@2", "b@3"]);

  assertRoundTrip(source, [{ type: "element.ungroup", container: SLIDE, groupId: "g" }]);
});

test("deleting a Group deletes its whole subtree and the inverse restores it", () => {
  const source = withElements(
    textElement("a", 0),
    groupElement("outer", 1),
    groupElement("inner", 0, "outer"),
    textElement("leaf", 0, "Leaf", "inner"),
    textElement("sibling", 1, "Sibling", "outer"),
    textElement("b", 2),
  );

  const applied = applyOperations(
    source,
    [{ type: "element.delete", container: SLIDE, elementId: "outer" }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(Object.keys(applied.snapshot.slides[SLIDE_ID].elements).sort(), ["a", "b"]);
  assert.deepEqual(zOrder(applied.snapshot), ["a@0", "b@1"]);

  assertRoundTrip(source, [{ type: "element.delete", container: SLIDE, elementId: "outer" }]);
});

test("paint order emits a Group's members immediately after the Group", () => {
  const snapshot = withElements(
    textElement("a", 0),
    groupElement("g", 1),
    textElement("m1", 0, "M1", "g"),
    textElement("m2", 1, "M2", "g"),
    textElement("b", 2),
  );
  assert.deepEqual(
    paintOrder(snapshot.slides[SLIDE_ID].elements).map((element) => element.id),
    ["a", "g", "m1", "m2", "b"],
  );
});

// ── Element content ──────────────────────────────────────────────────────

test("placement, style, rotation and flag edits invert exactly", () => {
  const source = withElements({ ...textElement("a", 0), styleId: ACCENT_STYLE });

  assertRoundTrip(source, [
    {
      type: "element.set-placement",
      container: SLIDE,
      elementId: "a",
      placement: { kind: "slot", slotId: BODY_SLOT },
    },
  ]);
  assertRoundTrip(source, [
    { type: "element.set-style", container: SLIDE, elementId: "a", styleId: NORMAL_STYLE },
  ]);
  // Clearing an optional field must invert back to its absence, not to a default.
  assertRoundTrip(source, [
    { type: "element.set-style", container: SLIDE, elementId: "a" },
  ]);
  assertRoundTrip(source, [
    { type: "element.set-rotation", container: SLIDE, elementId: "a", rotationDegrees: 45 },
  ]);
  assertRoundTrip(source, [
    { type: "element.set-flags", container: SLIDE, elementId: "a", locked: true, hidden: true },
  ]);
});

test("element.replace is a content edit and never moves the element", () => {
  const source = withElements(textElement("a", 0), textElement("b", 1), textElement("c", 2));
  const applied = applyOperations(
    source,
    [
      {
        type: "element.replace",
        container: SLIDE,
        element: { ...textElement("b", 99), body: { kind: "rich", content: content("nb", "New") } },
      },
    ],
    richText(),
    LIMITS,
  );
  assert.equal(applied.snapshot.slides[SLIDE_ID].elements.b.zIndex, 1);
  assert.deepEqual(zOrder(applied.snapshot), ["a@0", "b@1", "c@2"]);

  assertRoundTrip(source, [
    {
      type: "element.replace",
      container: SLIDE,
      element: { ...textElement("b", 99), body: { kind: "rich", content: content("nb", "New") } },
    },
  ]);
});

test("converting a text source between rich and prompt inverts exactly", () => {
  const source = withElements(textElement("a", 0, "Authored"));
  const site = bodySite("a") as const;

  const applied = applyOperations(
    source,
    [
      {
        type: "text-source.set",
        target: site,
        source: { kind: "prompt", output: { outputId: "output-1", appliedRevision: 1 } },
      },
    ],
    richText(),
    LIMITS,
  );
  assert.deepEqual((applied.snapshot.slides[SLIDE_ID].elements.a as TextElement).body, {
    kind: "prompt",
    output: { outputId: "output-1", appliedRevision: 1 },
  });

  // The displaced Rich Content must come back verbatim.
  assertRoundTrip(source, [
    {
      type: "text-source.set",
      target: site,
      source: { kind: "prompt", output: { outputId: "output-1", appliedRevision: 1 } },
    },
  ]);

  assertRoundTrip(applied.snapshot, [
    {
      type: "text-source.set",
      target: site,
      source: { kind: "rich", content: content("replacement", "Authored again") },
    },
  ]);
});

test("a prompt source takes a new revision through apply-derived-output and inverts", () => {
  const source = withElements({
    ...textElement("a", 0),
    body: { kind: "prompt", output: { outputId: "output-1", appliedRevision: 1 } },
  });

  assertRoundTrip(source, [
    {
      type: "prompt.apply-derived-output",
      site: bodySite("a"),
      output: { outputId: "output-1", appliedRevision: 4 },
    },
  ]);

  assert.throws(
    () =>
      applyOperations(
        withElements(textElement("a", 0)),
        [
          {
            type: "prompt.apply-derived-output",
            site: bodySite("a"),
            output: { outputId: "output-1", appliedRevision: 4 },
          },
        ],
        richText(),
        LIMITS,
      ),
    SlideOperationError,
  );
});

test("prompt sites are found in text element bodies and table cells", () => {
  const snapshot = withElements(
    { ...textElement("a", 0), body: { kind: "prompt", output: { outputId: "o1", appliedRevision: 1 } } },
    tableElement("t", 1),
  );
  const cells = (snapshot.slides[SLIDE_ID].elements.t as { table: SlideTable }).table.cells;
  cells[0].body = { kind: "prompt", output: { outputId: "o2", appliedRevision: 2 } };

  assert.deepEqual(
    promptSites(snapshot).map((entry) => `${entry.site.kind}:${entry.outputId}`),
    ["element-body:o1", "table-cell:o2"],
  );
});

test("a rich-text.apply inverts through the Rich Text engine", () => {
  const source = withElements(textElement("a", 0, "Hello"));
  assertRoundTrip(source, [
    {
      type: "rich-text.apply",
      target: { kind: "element-body", container: SLIDE, elementId: "a" },
      operations: [
        { type: "insert-text", at: { atomId: "a-atom", offset: 5 }, text: " world" },
      ],
    },
  ]);
});

test("rich-text.apply refuses a prompt-sourced surface", () => {
  const source = withElements({
    ...textElement("a", 0),
    body: { kind: "prompt", output: { outputId: "o1", appliedRevision: 1 } },
  });
  assert.throws(
    () =>
      applyOperations(
        source,
        [
          {
            type: "rich-text.apply",
            target: { kind: "element-body", container: SLIDE, elementId: "a" },
            operations: [],
          },
        ],
        richText(),
        LIMITS,
      ),
    SlideOperationError,
  );
});

test("a changed formula atom is reported once, with the target that addresses it", () => {
  const source = withElements(textElement("a", 0, "Total: "));
  const applied = applyOperations(
    source,
    [
      {
        type: "element.replace",
        container: SLIDE,
        element: {
          ...textElement("a", 0),
          body: {
            kind: "rich",
            content: {
              atoms: [
                { id: "a-atom", kind: "text", text: "Total: " },
                {
                  id: "a-formula",
                  kind: "formula",
                  expression: "revenue / units",
                  displayText: "—",
                },
              ],
              marks: [],
            },
          },
        },
      },
    ],
    richText(),
    LIMITS,
  );
  assert.deepEqual(applied.formulaChanges, [
    {
      atomId: "a-formula",
      target: { kind: "element-body", container: SLIDE, elementId: "a" },
      expression: "revenue / units",
    },
  ]);
});

// ── Tables ───────────────────────────────────────────────────────────────

test("table row and column operations invert exactly, restoring cells and merges", () => {
  const source = withElements(tableElement("t", 0));
  const sourceTable = (source.slides[SLIDE_ID].elements.t as { table: SlideTable }).table;
  sourceTable.merges = [{ id: "t-m1", rootCellId: "t-r2c1", coveredCellIds: ["t-r2c2"] }];

  assertRoundTrip(source, [
    {
      type: "table.insert-row",
      container: SLIDE,
      elementId: "t",
      row: { id: "t-r3", header: false },
      cells: [
        cell("t-r3c1", "t-r3", "t-c1", "E"),
        cell("t-r3c2", "t-r3", "t-c2", "F"),
      ],
      afterRowId: "t-r1",
    },
  ]);
  assertRoundTrip(source, [
    { type: "table.move-row", container: SLIDE, elementId: "t", rowId: "t-r2" },
  ]);
  assertRoundTrip(source, [
    { type: "table.delete-row", container: SLIDE, elementId: "t", rowId: "t-r2" },
  ]);
  assertRoundTrip(source, [
    { type: "table.move-column", container: SLIDE, elementId: "t", columnId: "t-c2" },
  ]);
  assertRoundTrip(source, [
    { type: "table.delete-column", container: SLIDE, elementId: "t", columnId: "t-c2" },
  ]);

  const deleted = applyOperations(
    source,
    [{ type: "table.delete-row", container: SLIDE, elementId: "t", rowId: "t-r2" }],
    richText(),
    LIMITS,
  );
  const remaining = (deleted.snapshot.slides[SLIDE_ID].elements.t as { table: SlideTable }).table;
  assert.deepEqual(remaining.rows.map((row) => row.id), ["t-r1"]);
  assert.deepEqual(remaining.cells.map((entry) => entry.id), ["t-r1c1", "t-r1c2"]);
  assert.deepEqual(remaining.merges, []);
});

test("merging and unmerging invert exactly", () => {
  const source = withElements(tableElement("t", 0));
  assertRoundTrip(source, [
    {
      type: "table.merge",
      container: SLIDE,
      elementId: "t",
      merge: { id: "t-m1", rootCellId: "t-r1c1", coveredCellIds: ["t-r1c2"] },
    },
  ]);

  const merged = applyOperations(
    source,
    [
      {
        type: "table.merge",
        container: SLIDE,
        elementId: "t",
        merge: { id: "t-m1", rootCellId: "t-r1c1", coveredCellIds: ["t-r1c2"] },
      },
    ],
    richText(),
    LIMITS,
  );
  assertRoundTrip(merged.snapshot, [
    { type: "table.unmerge", container: SLIDE, elementId: "t", mergeId: "t-m1" },
  ]);
});

// ── Multi-operation batches ──────────────────────────────────────────────

test("a batch inverts in reverse order", () => {
  const source = withElements(textElement("a", 0), textElement("b", 1));
  const operations: SlideOperation[] = [
    { type: "deck.rename", title: "Step one" },
    { type: "element.insert", container: SLIDE, element: textElement("c", 2) },
    { type: "element.delete", container: SLIDE, elementId: "a" },
    { type: "element.reorder", container: SLIDE, elementId: "c", zIndex: 0 },
  ];
  assertRoundTrip(source, operations);

  const applied = applyOperations(source, operations, richText(), LIMITS);
  assert.equal(applied.inverse[0].type, "element.reorder");
  assert.equal(applied.inverse[applied.inverse.length - 1].type, "deck.rename");
});

test("invertOperations agrees with the reducer it delegates to", () => {
  const source = withElements(textElement("a", 0));
  const operations: SlideOperation[] = [
    { type: "element.insert", container: SLIDE, element: textElement("b", 1) },
  ];
  assert.deepEqual(
    invertOperations(source, operations, richText(), LIMITS),
    applyOperations(source, operations, richText(), LIMITS).inverse,
  );
});

test("a batch that ends invalid is refused whole", () => {
  const source = withElements(groupElement("g", 0), textElement("m", 0, "M", "g"));
  assert.throws(
    () =>
      applyOperations(
        source,
        [{ type: "element.delete", container: SLIDE, elementId: "m" }],
        richText(),
        LIMITS,
      ),
    SlideValidationError,
  );
});

// ── Touched IDs and rebase ───────────────────────────────────────────────

test("touched IDs cover the element, its subtree and its renumbered siblings", () => {
  const snapshot = withElements(
    textElement("a", 0),
    groupElement("g", 1),
    textElement("m", 0, "M", "g"),
    textElement("b", 2),
  );

  const deleted = computeTouchedIds(snapshot, [
    { type: "element.delete", container: SLIDE, elementId: "g" },
  ]);
  assert.deepEqual(deleted, ["a", "b", "g", "m"]);

  const styled = computeTouchedIds(snapshot, [
    { type: "element.set-style", container: SLIDE, elementId: "a", styleId: NORMAL_STYLE },
  ]);
  assert.deepEqual(styled, ["a"]);
});

test("touched IDs for a prompt write name the site as well as the element", () => {
  const snapshot = withElements({
    ...textElement("a", 0),
    body: { kind: "prompt", output: { outputId: "o1", appliedRevision: 1 } },
  });
  assert.deepEqual(
    computeTouchedIds(snapshot, [
      {
        type: "prompt.apply-derived-output",
        site: bodySite("a"),
        output: { outputId: "o1", appliedRevision: 2 },
      },
    ]),
    ["a", `element-body:slide:${SLIDE_ID}:a`],
  );
});

test("the same element ID in two planes is two distinct prompt sites", () => {
  // The site key carries the container, so a Master element and a Slide element
  // that happen to share an ID never collide in the ownership table.
  const snapshot = blankSnapshot();
  const prompted = {
    ...textElement("shared", 0),
    body: { kind: "prompt" as const, output: { outputId: "o1", appliedRevision: 1 } },
  };
  snapshot.slides[SLIDE_ID].elements = { shared: prompted };
  snapshot.masters[MASTER_ID].elements = {
    shared: { ...prompted, body: { kind: "prompt", output: { outputId: "o2", appliedRevision: 1 } } },
  };

  assert.deepEqual(
    promptSites(snapshot).map((entry) => promptSiteKey(entry.site)),
    [`element-body:master:${MASTER_ID}:shared`, `element-body:slide:${SLIDE_ID}:shared`],
  );
});

test("rebase is allowed only when no touched ID intervened", () => {
  const changeSet = (touchedIds: string[]): DeckChangeSet =>
    ({ touchedIds }) as DeckChangeSet;

  assert.deepEqual(canRebase(["a", "b"], [changeSet(["c"])]), {
    allowed: true,
    conflictingIds: [],
  });
  assert.deepEqual(canRebase(["a", "b"], [changeSet(["b", "c"]), changeSet(["a"])]), {
    allowed: false,
    conflictingIds: ["a", "b"],
  });
});

// ── Identities ───────────────────────────────────────────────────────────

test("every governed identity is collected, and external references are not", () => {
  const snapshot = withElements(
    textElement("a", 0),
    tableElement("t", 1),
    {
      ...textElement("prompted", 2),
      body: { kind: "prompt", output: { outputId: "output-external", appliedRevision: 1 } },
    },
  );
  const identities = collectSlideIdentities(snapshot);
  const kinds = new Set(identities.map((identity) => identity.kind));

  assert.ok(kinds.has("style"));
  assert.ok(kinds.has("token"));
  assert.ok(kinds.has("master"));
  assert.ok(kinds.has("layout"));
  assert.ok(kinds.has("slot"));
  assert.ok(kinds.has("slide"));
  assert.ok(kinds.has("element"));
  assert.ok(kinds.has("table-cell"));
  assert.ok(kinds.has("rich-text-atom"));

  // Derived Output IDs belong to Derived Outputs, so Slides never claims them.
  assert.ok(!identities.some((identity) => identity.id === "output-external"));
  // A prompt source contributes no Rich Text identities.
  assert.ok(!identities.some((identity) => identity.id === "prompted-atom"));
});

test("identity transitions report exactly what a mutation added and removed", () => {
  const source = withElements(textElement("a", 0));
  const applied = applyOperations(
    source,
    [{ type: "element.insert", container: SLIDE, element: textElement("b", 1) }],
    richText(),
    LIMITS,
  );
  const transitions = computeSlideIdentityTransitions(source, applied.snapshot);

  assert.deepEqual(
    transitions.added.map((identity) => `${identity.kind}:${identity.id}`).sort(),
    ["element:b", "rich-text-atom:b-atom"],
  );
  assert.deepEqual(transitions.removed, []);

  const deleted = applyOperations(
    source,
    [{ type: "element.delete", container: SLIDE, elementId: "a" }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(
    computeSlideIdentityTransitions(source, deleted.snapshot)
      .removed.map((identity) => `${identity.kind}:${identity.id}`)
      .sort(),
    ["element:a", "rich-text-atom:a-atom"],
  );
});

// ── Presentation ─────────────────────────────────────────────────────────

test("the three planes resolve back to front, Master first", () => {
  const snapshot = withElements(textElement("on-slide", 0));
  snapshot.masters[MASTER_ID].elements = { "on-master": textElement("on-master", 0) };
  snapshot.layouts[LAYOUT_ID].elements = { "on-layout": textElement("on-layout", 0) };

  const plan = resolveSlidePlan(snapshot, SLIDE_ID);
  assert.deepEqual(
    plan?.entries.map((entry) => entry.element.id),
    ["on-master", "on-layout", "on-slide"],
  );
  assert.equal(plan?.masterId, MASTER_ID);
  assert.equal(plan?.layoutId, LAYOUT_ID);
});

test("background resolves Slide over Layout over Master", () => {
  const snapshot = blankSnapshot();
  assert.deepEqual(resolveBackground(snapshot, SLIDE_ID), {
    kind: "solid",
    color: { kind: "token", tokenId: PAPER_TOKEN },
  });

  snapshot.layouts[LAYOUT_ID].background = {
    kind: "solid",
    color: { kind: "literal", value: "#eeeeee" },
  };
  assert.deepEqual(resolveBackground(snapshot, SLIDE_ID), {
    kind: "solid",
    color: { kind: "literal", value: "#eeeeee" },
  });

  snapshot.slides[SLIDE_ID].background = {
    kind: "solid",
    color: { kind: "literal", value: "#000000" },
  };
  assert.deepEqual(resolveBackground(snapshot, SLIDE_ID), {
    kind: "solid",
    color: { kind: "literal", value: "#000000" },
  });

  // An explicit `inherit` falls through rather than overriding.
  snapshot.slides[SLIDE_ID].background = { kind: "inherit" };
  assert.deepEqual(resolveBackground(snapshot, SLIDE_ID), {
    kind: "solid",
    color: { kind: "literal", value: "#eeeeee" },
  });
});

test("a slot-bound element takes the slot's frame and follows slot edits live", () => {
  const snapshot = withElements({
    ...textElement("bound", 0),
    placement: { kind: "slot", slotId: TITLE_SLOT },
  });
  assert.deepEqual(
    resolveElementFrame(snapshot, SLIDE, snapshot.slides[SLIDE_ID].elements.bound),
    frame(40, 40, 600, 80),
  );

  const moved = applyOperations(
    snapshot,
    [
      {
        type: "slot.update",
        layoutId: LAYOUT_ID,
        slot: { id: TITLE_SLOT, name: "Title", frame: frame(0, 0, 300, 40), accepts: ["text"] },
      },
    ],
    richText(),
    LIMITS,
  );
  assert.deepEqual(
    resolveElementFrame(moved.snapshot, SLIDE, moved.snapshot.slides[SLIDE_ID].elements.bound),
    frame(0, 0, 300, 40),
  );

  assert.deepEqual([...slotBindings(snapshot, SLIDE_ID)], [[TITLE_SLOT, "bound"]]);
  assert.deepEqual(
    unfilledSlots(snapshot, SLIDE_ID).map((slot) => slot.id),
    [BODY_SLOT],
  );
});

test("theme values resolve through tokens and refuse a kind mismatch", () => {
  const theme = blankSnapshot().theme;
  assert.equal(resolveColor(theme, { kind: "token", tokenId: INK_TOKEN }), "#111111");
  assert.equal(resolveColor(theme, { kind: "literal", value: "#abcdef" }), "#abcdef");
  assert.equal(resolveColor(theme, { kind: "token", tokenId: BASE_SIZE_TOKEN }), undefined);
  assert.equal(resolveColor(theme, { kind: "token", tokenId: "absent" }), undefined);
});

test("style resolution walks the basedOn chain nearest ancestor last", () => {
  const snapshot = blankSnapshot();
  const resolved = resolveSlideStyle(snapshot, ACCENT_STYLE);
  assert.equal(resolved.text.fontWeight, 700);
  assert.equal(resolved.text.color, "#111111");
  assert.equal(resolved.box.paddingPt, 4);

  const cyclic = blankSnapshot();
  cyclic.styles.styles[0].basedOnStyleId = ACCENT_STYLE;
  assert.throws(() => resolveSlideStyle(cyclic, ACCENT_STYLE), SlideStyleReferenceError);
});

// ── Canonical form ───────────────────────────────────────────────────────

test("canonical bytes ignore key order and distinguish content", () => {
  const bytes = (snapshot: DeckSnapshot) =>
    Buffer.from(canonicalizeSnapshot(snapshot)).toString("utf8");

  const left = blankSnapshot();
  const right: DeckSnapshot = {
    ...blankSnapshot(),
    // Same content, different insertion order.
    lifecycle: "active",
    title: "Domain test deck",
  };
  assert.equal(bytes(left), bytes(right));

  const changed = blankSnapshot();
  changed.title = "Different";
  assert.notEqual(bytes(left), bytes(changed));
});

test("a container edit is invisible to other containers", () => {
  const source = blankSnapshot();
  source.masters[MASTER_ID].elements = { "on-master": textElement("on-master", 0) };

  const applied = applyOperations(
    source,
    [{ type: "element.insert", container: MASTER, element: textElement("second", 1) }],
    richText(),
    LIMITS,
  );
  assert.deepEqual(Object.keys(applied.snapshot.slides[SLIDE_ID].elements), []);
  assert.deepEqual(
    Object.keys(applied.snapshot.masters[MASTER_ID].elements).sort(),
    ["on-master", "second"],
  );

  assertRoundTrip(source, [
    { type: "element.insert", container: MASTER, element: textElement("second", 1) },
  ]);
  assertRoundTrip(source, [
    { type: "element.insert", container: LAYOUT, element: textElement("in-layout", 0) },
  ]);
});

test("an operation against a missing container or element is refused", () => {
  const source = blankSnapshot();
  assert.throws(
    () =>
      applyOperations(
        source,
        [
          {
            type: "element.insert",
            container: { kind: "slide", slideId: "slide-absent" },
            element: textElement("a", 0),
          },
        ],
        richText(),
        LIMITS,
      ),
    SlideOperationError,
  );
  assert.throws(
    () =>
      applyOperations(
        source,
        [{ type: "element.delete", container: SLIDE, elementId: "absent" }],
        richText(),
        LIMITS,
      ),
    SlideOperationError,
  );
});

// ── Outline ──────────────────────────────────────────────────────────────

test("the outline is Markdown: first text is the heading, the rest are bullets", () => {
  const source = withElements(
    textElement("a", 0, "Revenue grew 40%"),
    textElement("b", 1, "Q3 closed at $4.2M"),
    textElement("c", 2, "Enterprise drove 60% of new ARR"),
  );
  assert.equal(
    deckOutline(source),
    [
      "# Revenue grew 40%",
      "",
      "- Q3 closed at $4.2M",
      "- Enterprise drove 60% of new ARR",
      "",
      "> Speaker notes",
    ].join("\n"),
  );
});

test("the outline follows paint order, not element ID order", () => {
  // Named so that ID order and zIndex order disagree: sorting by ID would put
  // "a" first and make it the heading.
  const source = withElements(textElement("a", 1, "Second"), textElement("b", 0, "First"));
  assert.match(deckOutline(source), /^# First\n\n- Second\n/);
});

test("a table keeps its grid, and empty text contributes nothing", () => {
  const source = withElements(textElement("a", 0, "Results"), tableElement("t", 1));
  assert.equal(
    deckOutline(source),
    ["# Results", "", "| A | B |", "| --- | --- |", "| C | D |", "", "> Speaker notes"].join("\n"),
  );

  const empty = withElements(textElement("a", 0, "   "), textElement("b", 1, "Only line"));
  // The blank element is skipped entirely, so the heading is the next real text.
  assert.match(deckOutline(empty), /^# Only line\n/);
});

test("a prompt source contributes nothing until it has settled", () => {
  const source = withElements(textElement("a", 0, "Heading"), textElement("b", 1, "Body"));
  const promptElement = source.slides[SLIDE_ID].elements.b;
  if (promptElement.kind !== "text") throw new Error("expected a text element");
  promptElement.body = { kind: "prompt", output: { outputId: "output-1" } };

  const outline = deckOutline(source);
  assert.match(outline, /^# Heading\n/);
  assert.doesNotMatch(outline, /Body/);
});

test("Master and Layout text stays out of the outline", () => {
  const source = withElements(textElement("a", 0, "Slide text"));
  source.masters[MASTER_ID].elements = { m: textElement("m", 0, "Confidential") };
  source.layouts[LAYOUT_ID].elements = { l: textElement("l", 0, "Running header") };

  // Chrome repeats behind every Slide; emitting it would put the same sentence
  // into the lattice once per Slide.
  const outline = deckOutline(source);
  assert.doesNotMatch(outline, /Confidential/);
  assert.doesNotMatch(outline, /Running header/);
  assert.match(outline, /Slide text/);
});

test("slides are separated, and a Slide with no text contributes nothing", () => {
  const source = withElements(textElement("a", 0, "One"));
  source.slides[SLIDE_ID].notes = { atoms: [], marks: [] };
  const secondId = "slide-2";
  source.slides[secondId] = {
    id: secondId,
    layoutId: LAYOUT_ID,
    notes: { atoms: [], marks: [] },
    elements: { b: textElement("b", 0, "Two") },
  };
  const emptyId = "slide-3";
  source.slides[emptyId] = {
    id: emptyId,
    layoutId: LAYOUT_ID,
    notes: { atoms: [], marks: [] },
    elements: {},
  };
  source.slideOrder = [SLIDE_ID, emptyId, secondId];

  // The empty Slide leaves no trace at all — not a blank heading, not a gap.
  assert.equal(deckOutline(source), "# One\n\n# Two");
});
