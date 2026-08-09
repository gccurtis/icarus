import assert from "node:assert/strict";
import test from "node:test";
import type {
  DeckSnapshot,
  ElementContainerRef,
  SlideElement,
  SlideCommand,
  SlideOperation,
  SlideQuery
} from "../../src/3-capabilities/slides/domain/model.js";
import { SlideWireError } from "../../src/3-capabilities/slides/wire/valueSchemas.js";
import { computeTouchedIds } from "../../src/3-capabilities/slides/domain/reducer.js";
import {
  INITIAL_LAYOUT_ID,
  INITIAL_MASTER_ID,
  INITIAL_SLIDE_ID,
  createBlankDeckSnapshot
} from "../../src/3-capabilities/slides/application/createService.js";
import {
  SLIDE_OPERATION_TYPES,
  decodeSlideOperation,
  decodeSlideOperations
} from "../../src/3-capabilities/slides/wire/operationSchemas.js";
import {
  SLIDE_COMMAND_TYPES,
  decodeSlideCommand
} from "../../src/3-capabilities/slides/wire/commandSchemas.js";
import {
  MAX_HISTORY_LIMIT,
  SLIDE_QUERY_TYPES,
  decodeSlideQuery
} from "../../src/3-capabilities/slides/wire/querySchemas.js";

const SLIDE: ElementContainerRef = { kind: "slide", slideId: "slide-1" };

const content = (id: string, text: string) => ({
  atoms: [{ id, kind: "text", text }],
  marks: []
});

const frame = () => ({ xPt: 10, yPt: 10, widthPt: 100, heightPt: 50 });

const textElement = () => ({
  id: "element-1",
  kind: "text",
  zIndex: 0,
  placement: { kind: "free", frame: frame() },
  locked: false,
  hidden: false,
  body: { kind: "rich", content: content("atom-1", "Hello") }
});

const MASTER = { kind: "master", masterId: "master-1" } as const;
const LAYOUT = { kind: "layout", layoutId: "layout-1" } as const;

const cellSample = (id: string, rowId: string, columnId: string) => ({
  id,
  rowId,
  columnId,
  body: { kind: "rich" as const, content: content(`${id}-atom`, "x") },
  verticalAlign: "top" as const
});

const tableSample = () => ({
  id: "table-1",
  columns: [{ id: "col-1", width: { kind: "auto" as const } }],
  rows: [{ id: "row-1", header: false }],
  cells: [cellSample("cell-1", "row-1", "col-1")],
  merges: []
});

const slideSample = (id: string) => ({
  id,
  layoutId: "layout-1",
  notes: content(`${id}-notes`, ""),
  elements: {}
});

const styleSample = (id: string) => ({ id, name: "S" });
const tokenSample = (id: string) => ({ id, kind: "color" as const, name: "T", value: "#000000" });
const slotSample = (id: string) => ({ id, name: "S", frame: frame(), accepts: [] });
const groupSample = (id: string) => ({
  id,
  kind: "group" as const,
  zIndex: 0,
  placement: { kind: "free" as const, frame: frame() },
  locked: false,
  hidden: false
});
const mediaSample = () => ({
  fileId: "file-1",
  version: "v1",
  digest: "d1",
  mimeType: "image/png"
});
const paletteSample = () => ({
  background: { kind: "literal" as const, value: "#ffffff" },
  surface: { kind: "literal" as const, value: "#eeeeee" },
  text: { kind: "literal" as const, value: "#000000" },
  accent: { kind: "literal" as const, value: "#0055ff" }
});
const typographySample = () => ({
  headingFontFamily: { kind: "literal" as const, value: "Inter" },
  bodyFontFamily: { kind: "literal" as const, value: "Inter" },
  baseFontSizePt: { kind: "literal" as const, value: 18 }
});

/** One representative payload per operation type, for the touched-ID sweep. */
const TOUCHED_ID_SAMPLES: Record<string, unknown> = {
  "deck.rename": { type: "deck.rename", title: "T" },
  "deck.set-lifecycle": { type: "deck.set-lifecycle", lifecycle: "archived" },
  "canvas.set": { type: "canvas.set", canvas: { widthPt: 720, heightPt: 405 } },
  "theme.rename": { type: "theme.rename", name: "T" },
  "theme.set-palette": { type: "theme.set-palette", palette: paletteSample() },
  "theme.set-typography": { type: "theme.set-typography", typography: typographySample() },
  "token.create": { type: "token.create", token: tokenSample("token-new") },
  "token.update": { type: "token.update", tokenId: "token-1", token: tokenSample("token-1") },
  "token.delete": { type: "token.delete", tokenId: "token-1", replacementTokenId: "token-2" },
  "style.create": { type: "style.create", style: styleSample("style-new") },
  "style.update": { type: "style.update", styleId: "style-1", style: styleSample("style-1") },
  "style.delete": { type: "style.delete", styleId: "style-1", replacementStyleId: "style-2" },
  "style.set-default": { type: "style.set-default", elementKind: "text", styleId: "style-1" },
  "master.insert": {
    type: "master.insert",
    master: { id: "master-2", name: "M", background: { kind: "inherit" }, elements: {} }
  },
  "master.rename": { type: "master.rename", masterId: "master-1", name: "M" },
  "master.set-background": {
    type: "master.set-background",
    masterId: "master-1",
    background: { kind: "inherit" }
  },
  "master.delete": {
    type: "master.delete",
    masterId: "master-1",
    replacementMasterId: "master-2"
  },
  "layout.insert": {
    type: "layout.insert",
    layout: { id: "layout-2", name: "L", masterId: "master-1", elements: {}, slots: {} }
  },
  "layout.rename": { type: "layout.rename", layoutId: "layout-1", name: "L" },
  "layout.set-master": { type: "layout.set-master", layoutId: "layout-1", masterId: "master-1" },
  "layout.set-background": { type: "layout.set-background", layoutId: "layout-1" },
  "layout.delete": {
    type: "layout.delete",
    layoutId: "layout-1",
    replacementLayoutId: "layout-2"
  },
  "slot.insert": { type: "slot.insert", layoutId: "layout-1", slot: slotSample("slot-new") },
  "slot.update": { type: "slot.update", layoutId: "layout-1", slot: slotSample("slot-1") },
  "slot.delete": { type: "slot.delete", layoutId: "layout-1", slotId: "slot-1" },
  "slide.insert": { type: "slide.insert", slide: slideSample("slide-2") },
  "slide.move": { type: "slide.move", slideId: "slide-1" },
  "slide.delete": { type: "slide.delete", slideId: "slide-1" },
  "slide.set-layout": { type: "slide.set-layout", slideId: "slide-1", layoutId: "layout-1" },
  "slide.set-background": { type: "slide.set-background", slideId: "slide-1" },
  "element.insert": { type: "element.insert", container: SLIDE, element: textElement() },
  "element.replace": { type: "element.replace", container: SLIDE, element: textElement() },
  "element.reorder": {
    type: "element.reorder",
    container: SLIDE,
    elementId: "element-1",
    zIndex: 0
  },
  "element.delete": { type: "element.delete", container: SLIDE, elementId: "element-1" },
  "element.set-placement": {
    type: "element.set-placement",
    container: SLIDE,
    elementId: "element-1",
    placement: { kind: "free", frame: frame() }
  },
  "element.set-style": {
    type: "element.set-style",
    container: SLIDE,
    elementId: "element-1"
  },
  "element.set-rotation": {
    type: "element.set-rotation",
    container: SLIDE,
    elementId: "element-1"
  },
  "element.set-flags": {
    type: "element.set-flags",
    container: SLIDE,
    elementId: "element-1",
    locked: true,
    hidden: false
  },
  "element.group": {
    type: "element.group",
    container: SLIDE,
    group: groupSample("group-1"),
    memberIds: ["element-1"]
  },
  "element.ungroup": { type: "element.ungroup", container: SLIDE, groupId: "group-1" },
  "text-source.set": {
    type: "text-source.set",
    target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
    source: { kind: "rich", content: content("a1", "x") }
  },
  "rich-text.apply": {
    type: "rich-text.apply",
    target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
    operations: [{ type: "delete-atom", atomId: "atom-1" }]
  },
  "prompt.apply-derived-output": {
    type: "prompt.apply-derived-output",
    site: { kind: "element-body", container: SLIDE, elementId: "element-1" },
    output: { outputId: "o1", appliedRevision: 1 }
  },
  "table.insert-row": {
    type: "table.insert-row",
    container: SLIDE,
    elementId: "table-el",
    row: { id: "row-2", header: false },
    cells: [cellSample("cell-2", "row-2", "col-1")]
  },
  "table.move-row": {
    type: "table.move-row",
    container: SLIDE,
    elementId: "table-el",
    rowId: "row-1"
  },
  "table.delete-row": {
    type: "table.delete-row",
    container: SLIDE,
    elementId: "table-el",
    rowId: "row-1"
  },
  "table.insert-column": {
    type: "table.insert-column",
    container: SLIDE,
    elementId: "table-el",
    column: { id: "col-2", width: { kind: "auto" } },
    cells: [cellSample("cell-3", "row-1", "col-2")]
  },
  "table.move-column": {
    type: "table.move-column",
    container: SLIDE,
    elementId: "table-el",
    columnId: "col-1"
  },
  "table.delete-column": {
    type: "table.delete-column",
    container: SLIDE,
    elementId: "table-el",
    columnId: "col-1"
  },
  "table.merge": {
    type: "table.merge",
    container: SLIDE,
    elementId: "table-el",
    merge: { id: "merge-1", rootCellId: "cell-1", coveredCellIds: ["cell-2"] }
  },
  "table.unmerge": {
    type: "table.unmerge",
    container: SLIDE,
    elementId: "table-el",
    mergeId: "merge-1"
  },
  "image.set-source": {
    type: "image.set-source",
    container: SLIDE,
    elementId: "image-el",
    source: mediaSample()
  },
  "image.set-accessibility": {
    type: "image.set-accessibility",
    container: SLIDE,
    elementId: "image-el",
    alt: "A",
    decorative: false
  }
};

/**
 * A snapshot the samples can resolve against. Touched-ID computation looks
 * things up, so a fixture with nothing in it would make several operations
 * report only the ID they were handed and hide a missing sentinel.
 */
const touchedIdFixture = (): DeckSnapshot => {
  const snapshot = createBlankDeckSnapshot({ title: "Touched" });
  const slide = snapshot.slides[INITIAL_SLIDE_ID];
  const remapped: DeckSnapshot = {
    ...snapshot,
    slideOrder: ["slide-1"],
    slides: {
      "slide-1": {
        ...slide,
        id: "slide-1",
        layoutId: "layout-1",
        elements: {
          "element-1": { ...textElement(), id: "element-1" } as SlideElement,
          "table-el": {
            ...textElement(),
            id: "table-el",
            kind: "table",
            table: tableSample()
          } as unknown as SlideElement
        }
      }
    },
    masters: {
      "master-1": { ...snapshot.masters[INITIAL_MASTER_ID], id: "master-1" }
    },
    layouts: {
      "layout-1": {
        ...snapshot.layouts[INITIAL_LAYOUT_ID],
        id: "layout-1",
        masterId: "master-1",
        slots: { "slot-1": slotSample("slot-1") }
      }
    }
  };
  return remapped;
};

const rejects = (run: () => unknown, match?: RegExp): void => {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof SlideWireError, `expected SlideWireError, got ${String(error)}`);
    if (match) assert.match((error as Error).message, match);
    return true;
  });
};

// ── Parity ───────────────────────────────────────────────────────────────

test("every operation in the union has a decoder", () => {
  // The decoder table is typed `Record<SlideOperation["type"], …>`, so a missing
  // row is a compile error. This asserts the runtime consequence as well, and
  // fixes the count so a silent removal is visible.
  const declared = new Set(SLIDE_OPERATION_TYPES);
  const sampled: SlideOperation["type"][] = [
    "deck.rename", "canvas.set", "token.create", "style.delete", "master.insert",
    "layout.set-background", "slot.update", "slide.move", "element.insert",
    "element.group", "text-source.set", "rich-text.apply",
    "prompt.apply-derived-output", "table.insert-row", "image.set-accessibility"
  ];
  for (const type of sampled) assert.ok(declared.has(type), type);
  assert.equal(declared.size, 53);
});

test("every operation claims at least one touched ID", () => {
  // Rebase decides whether a stale submission is still safe by comparing
  // touched IDs. An operation that claims none gives it nothing to compare, so
  // it would be admitted unconditionally — which is exactly how two renames
  // both landed and one was lost. Deck-level fields have no identity of their
  // own and use sentinels; this asserts none was missed.
  const snapshot = touchedIdFixture();
  for (const [type, sample] of Object.entries(TOUCHED_ID_SAMPLES)) {
    const ids = computeTouchedIds(snapshot, [sample as SlideOperation]);
    assert.ok(ids.length > 0, `${type} claims no touched ID`);
  }
  // And the sample table itself covers the whole union.
  assert.deepEqual(
    [...SLIDE_OPERATION_TYPES].sort(),
    Object.keys(TOUCHED_ID_SAMPLES).sort()
  );
});

test("every command and query in the union has a decoder", () => {
  assert.deepEqual([...SLIDE_COMMAND_TYPES].sort(), [
    "deck.compensate", "deck.create", "deck.delete", "deck.purge", "deck.submit",
    "formula.evaluate.request", "prompt.create.request", "prompt.refresh.request",
    "prompt.update-definition"
  ] satisfies SlideCommand["type"][]);
  assert.deepEqual([...SLIDE_QUERY_TYPES].sort(), [
    "deck.attempt", "deck.history", "deck.list", "deck.load", "deck.outline"
  ] satisfies SlideQuery["type"][]);
});

// ── Structural rejection ─────────────────────────────────────────────────

test("an unknown field is rejected, and the message names it", () => {
  rejects(
    () => decodeSlideOperation({ type: "deck.rename", title: "T", extra: 1 }),
    /unknown fields: extra/
  );
  rejects(
    () =>
      decodeSlideCommand({
        origin: "interactive",
        command: { type: "deck.purge", deckId: "d1" },
        sneaky: true
      }),
    /unknown fields: sneaky/
  );
});

test("wrong types, missing fields and empty strings are rejected", () => {
  rejects(() => decodeSlideOperation({ type: "deck.rename", title: 7 }), /must be a string/);
  rejects(() => decodeSlideOperation({ type: "deck.rename" }), /must be a string/);
  rejects(() => decodeSlideOperation({ type: "deck.rename", title: "" }), /non-empty/);
  rejects(
    () => decodeSlideOperation({ type: "slide.delete", slideId: null }),
    /must be a string/
  );
});

test("an unknown discriminant is rejected by name", () => {
  rejects(() => decodeSlideOperation({ type: "deck.explode" }), /Unknown Slides operation/);
  rejects(
    () =>
      decodeSlideCommand({
        origin: "interactive",
        command: { type: "deck.explode" }
      }),
    /Unknown Slides command/
  );
  rejects(
    () => decodeSlideQuery({ query: { type: "deck.explode" } }),
    /Unknown Slides query/
  );
});

test("a wrong enum value is rejected and lists what is allowed", () => {
  rejects(
    () => decodeSlideOperation({ type: "deck.set-lifecycle", lifecycle: "deleted" }),
    /must be one of: active, archived, trashed/
  );
  rejects(
    () =>
      decodeSlideCommand({
        origin: "user",
        command: { type: "deck.purge", deckId: "d1" }
      }),
    /must be one of: interactive, agent, automation/
  );
});

test("non-JSON, cyclic and non-plain inputs are rejected", () => {
  const cyclic: Record<string, unknown> = { type: "deck.rename", title: "T" };
  cyclic.self = cyclic;
  rejects(() => decodeSlideOperation(cyclic), /must not be cyclic/);
  rejects(
    () => decodeSlideOperation({ type: "deck.rename", title: () => "T" }),
    /only JSON values/
  );
  rejects(() => decodeSlideOperation(Object.create({ type: "deck.rename" })), /plain object/);
  rejects(
    () => decodeSlideOperation({ type: "canvas.set", canvas: { widthPt: NaN, heightPt: 1 } }),
    /must be finite/
  );
});

test("oversized strings, arrays and nesting are rejected", () => {
  rejects(
    () => decodeSlideOperation({ type: "deck.rename", title: "x".repeat(300_000) }),
    /string size limit/
  );
  rejects(
    () => decodeSlideOperations(Array.from({ length: 1_001 }, () => ({
      type: "deck.rename",
      title: "T"
    }))),
    /operation limit/
  );
  let deep: unknown = "leaf";
  for (let level = 0; level < 40; level += 1) deep = { nested: deep };
  rejects(
    () => decodeSlideOperation({ type: "deck.rename", title: "T", nested: deep }),
    /unknown fields|nesting limit/
  );
});

test("an empty operations array is rejected", () => {
  rejects(() => decodeSlideOperations([]), /must not be empty/);
  rejects(() => decodeSlideOperations({}), /must be an array/);
});

// ── Slides-specific shapes ───────────────────────────────────────────────

test("an element decodes in every container plane", () => {
  for (const container of [
    SLIDE,
    { kind: "master", masterId: "master-1" },
    { kind: "layout", layoutId: "layout-1" }
  ]) {
    const decoded = decodeSlideOperation({
      type: "element.insert",
      container,
      element: textElement()
    });
    assert.deepEqual(decoded, { type: "element.insert", container, element: textElement() });
  }
  rejects(
    () =>
      decodeSlideOperation({
        type: "element.insert",
        container: { kind: "deck", deckId: "d1" },
        element: textElement()
      }),
    /must be one of: slide, master, layout/
  );
});

test("an element carrying a field from another kind is rejected", () => {
  // The per-kind key table is what makes this fail: `table` is not a key of a
  // text element, so it is an unknown field rather than an ignored one.
  rejects(
    () =>
      decodeSlideOperation({
        type: "element.insert",
        container: SLIDE,
        element: { ...textElement(), table: { id: "t" } }
      }),
    /unknown fields: table/
  );
});

test("a frame accepts fractional points but not a zero extent", () => {
  const decoded = decodeSlideOperation({
    type: "element.set-placement",
    container: SLIDE,
    elementId: "element-1",
    placement: { kind: "free", frame: { xPt: 10.5, yPt: -3.25, widthPt: 0.5, heightPt: 1.5 } }
  });
  assert.deepEqual((decoded as { placement: { frame: { xPt: number } } }).placement.frame, {
    xPt: 10.5,
    yPt: -3.25,
    widthPt: 0.5,
    heightPt: 1.5
  });
  rejects(
    () =>
      decodeSlideOperation({
        type: "element.set-placement",
        container: SLIDE,
        elementId: "element-1",
        placement: { kind: "free", frame: { ...frame(), widthPt: 0 } }
      }),
    /must be a positive number/
  );
});

test("a text source decodes both arms and rejects a mixed one", () => {
  assert.deepEqual(
    decodeSlideOperation({
      type: "text-source.set",
      target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
      source: { kind: "prompt", output: { outputId: "o1", appliedRevision: 2 } }
    }),
    {
      type: "text-source.set",
      target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
      source: { kind: "prompt", output: { outputId: "o1", appliedRevision: 2 } }
    }
  );
  rejects(
    () =>
      decodeSlideOperation({
        type: "text-source.set",
        target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
        source: { kind: "prompt", content: content("a", "x") }
      }),
    /unknown fields: content/
  );
  rejects(
    () =>
      decodeSlideOperation({
        type: "text-source.set",
        target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
        source: { kind: "prompt", output: { outputId: "o1", appliedRevision: 0 } }
      }),
    /positive integer/
  );
});

test("a prompt site does not accept slide-notes, but a content target does", () => {
  // Notes are authored only, so they are a Rich Content target and never a
  // prompt site. The two decoders differ by exactly this.
  rejects(
    () =>
      decodeSlideOperation({
        type: "prompt.apply-derived-output",
        site: { kind: "slide-notes", slideId: "slide-1" },
        output: { outputId: "o1", appliedRevision: 1 }
      }),
    /must be one of: element-body, table-cell/
  );
  const decoded = decodeSlideOperation({
    type: "rich-text.apply",
    target: { kind: "slide-notes", slideId: "slide-1" },
    operations: [{ type: "insert-text", at: { atomId: "a1", offset: 0 }, text: "x" }]
  });
  assert.equal((decoded as { target: { kind: string } }).target.kind, "slide-notes");
});

test("prompt.create names placement, never an element ID", () => {
  const request = decodeSlideCommand({
    origin: "agent",
    command: {
      type: "prompt.create.request",
      deckId: "deck-1",
      expectedRevision: 3,
      target: {
        kind: "new-text-element",
        container: SLIDE,
        placement: { kind: "slot", slotId: "slot-title" }
      },
      prompt: "Summarise the quarter",
      contextEntries: [],
      stabilisationText: ""
    }
  });
  assert.equal(request.origin, "agent");
  assert.equal(request.command.type, "prompt.create.request");

  rejects(
    () =>
      decodeSlideCommand({
        origin: "agent",
        command: {
          type: "prompt.create.request",
          deckId: "deck-1",
          expectedRevision: 3,
          target: {
            kind: "new-text-element",
            container: SLIDE,
            placement: { kind: "free", frame: frame() },
            elementId: "caller-chosen"
          },
          prompt: "x",
          contextEntries: [],
          stabilisationText: ""
        }
      }),
    /unknown fields: elementId/
  );
});

test("a Rich Text operation is decoded through the same table Rich Text declares", () => {
  const decoded = decodeSlideOperation({
    type: "rich-text.apply",
    target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
    operations: [
      { type: "insert-text", at: { atomId: "atom-1", offset: 5 }, text: " world" },
      { type: "delete-atom", atomId: "atom-2" }
    ]
  });
  assert.equal((decoded as { operations: unknown[] }).operations.length, 2);
  rejects(
    () =>
      decodeSlideOperation({
        type: "rich-text.apply",
        target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
        operations: [{ type: "insert-text", position: { atomId: "a", offset: 0 }, text: "x" }]
      }),
    /unknown fields: position/
  );
  rejects(
    () =>
      decodeSlideOperation({
        type: "rich-text.apply",
        target: { kind: "element-body", container: SLIDE, elementId: "element-1" },
        operations: []
      }),
    /must not be empty/
  );
});

test("Rich Content must carry at least one atom", () => {
  rejects(
    () =>
      decodeSlideOperation({
        type: "element.insert",
        container: SLIDE,
        element: { ...textElement(), body: { kind: "rich", content: { atoms: [], marks: [] } } }
      }),
    /atoms must not be empty/
  );
});

test("a style decodes its optional parts and rejects an unknown system role", () => {
  const decoded = decodeSlideOperation({
    type: "style.create",
    style: { id: "s1", name: "Accent", basedOnStyleId: "s0", text: { fontWeight: 700 } }
  });
  assert.deepEqual((decoded as { style: Record<string, unknown> }).style, {
    id: "s1",
    name: "Accent",
    basedOnStyleId: "s0",
    text: { fontWeight: 700 }
  });
  rejects(
    () =>
      decodeSlideOperation({
        type: "style.create",
        style: { id: "s1", name: "S", systemRole: "heading-1" }
      }),
    /must be one of: normal/
  );
  rejects(
    () => decodeSlideOperation({ type: "style.set-default", elementKind: "prompt", styleId: "s1" }),
    /must be one of: group, text, table, chart, image, geometry, line/
  );
});

test("an element record must be keyed by the ID it carries", () => {
  rejects(
    () =>
      decodeSlideOperation({
        type: "slide.insert",
        slide: {
          id: "slide-2",
          layoutId: "layout-1",
          notes: content("n1", "Notes"),
          elements: { "wrong-key": textElement() }
        }
      }),
    /keyed by a different ID/
  );
});

test("slide notes are Rich Content, not a text source", () => {
  rejects(
    () =>
      decodeSlideOperation({
        type: "slide.insert",
        slide: {
          id: "slide-2",
          layoutId: "layout-1",
          notes: { kind: "rich", content: content("n1", "Notes") },
          elements: {}
        }
      }),
    /unknown fields: kind, content/
  );
});

// ── Envelopes ────────────────────────────────────────────────────────────

test("a command envelope requires an origin and carries no request ID", () => {
  const decoded = decodeSlideCommand({
    origin: "automation",
    command: { type: "deck.create", title: "Deck" }
  });
  assert.deepEqual(decoded, {
    origin: "automation",
    command: { type: "deck.create", title: "Deck" }
  });

  rejects(
    () => decodeSlideCommand({ command: { type: "deck.purge", deckId: "d" } }),
    /origin must be one of/
  );
  // Retry safety is expectedRevision's job, so a caller-supplied idempotency
  // key is not merely unused — it is refused, rather than silently ignored.
  rejects(
    () =>
      decodeSlideCommand({
        requestId: "r1",
        origin: "interactive",
        command: { type: "deck.purge", deckId: "d" }
      }),
    /unknown fields: requestId/
  );
});

test("deck.create takes no identifier and an optional canvas", () => {
  const withCanvas = decodeSlideCommand({
    origin: "interactive",
    command: { type: "deck.create", title: "Deck", canvas: { widthPt: 960, heightPt: 540 } }
  });
  assert.deepEqual(withCanvas.command, {
    type: "deck.create",
    title: "Deck",
    canvas: { widthPt: 960, heightPt: 540 }
  });
  // An absent optional stays absent rather than becoming an explicit undefined.
  const without = decodeSlideCommand({
    origin: "interactive",
    command: { type: "deck.create", title: "Deck" }
  });
  assert.deepEqual(Object.keys(without.command).sort(), ["title", "type"]);

  rejects(
    () =>
      decodeSlideCommand({
        origin: "interactive",
        command: { type: "deck.create", title: "Deck", deckId: "caller-chosen" }
      }),
    /unknown fields: deckId/
  );
});

test("a query envelope decodes each query and bounds the history page", () => {
  assert.deepEqual(decodeSlideQuery({ query: { type: "deck.list" } }), {
    query: { type: "deck.list" }
  });
  assert.deepEqual(
    decodeSlideQuery({
      query: { type: "deck.load", deckId: "d1", revision: 4 }
    }).query,
    { type: "deck.load", deckId: "d1", revision: 4 }
  );
  rejects(
    () =>
      decodeSlideQuery({
        query: { type: "deck.history", deckId: "d1", limit: MAX_HISTORY_LIMIT + 1 }
      }),
    /exceeds the page limit/
  );
  rejects(
    () =>
      decodeSlideQuery({
        query: { type: "deck.load", deckId: "d1", revision: 0 }
      }),
    /positive integer/
  );
  // The outline is addressed exactly like a load, because it is one.
  assert.deepEqual(
    decodeSlideQuery({ query: { type: "deck.outline", deckId: "d1", revision: 4 } }).query,
    { type: "deck.outline", deckId: "d1", revision: 4 }
  );
  rejects(
    () => decodeSlideQuery({ query: { type: "deck.outline", deckId: "d1", text: "x" } }),
    /unknown fields: text/
  );
});

// ── Round trip ───────────────────────────────────────────────────────────

test("decoding is idempotent for every representative operation", () => {
  // Decode returns a structural clone, so decoding twice must be a fixed point.
  // A decoder that dropped or added a field would fail here even when the first
  // decode looked right.
  const samples: unknown[] = [
    { type: "deck.rename", title: "New" },
    { type: "canvas.set", canvas: { widthPt: 720, heightPt: 405 } },
    {
      type: "token.create",
      token: { id: "t1", kind: "color", name: "Ink", value: "#111111" }
    },
    { type: "style.set-default", elementKind: "text", styleId: "s1" },
    { type: "element.insert", container: SLIDE, element: textElement() },
    {
      type: "element.group",
      container: SLIDE,
      group: {
        id: "g1",
        kind: "group",
        zIndex: 0,
        placement: { kind: "free", frame: frame() },
        locked: false,
        hidden: false
      },
      memberIds: ["element-1", "element-2"]
    },
    {
      type: "table.insert-row",
      container: SLIDE,
      elementId: "table-1",
      row: { id: "r1", header: false },
      cells: [
        {
          id: "c1",
          rowId: "r1",
          columnId: "col1",
          body: { kind: "rich", content: content("a1", "A") },
          verticalAlign: "top"
        }
      ],
      afterRowId: "r0"
    },
    {
      type: "image.set-accessibility",
      container: SLIDE,
      elementId: "image-1",
      alt: "A chart",
      decorative: false
    }
  ];

  for (const sample of samples) {
    const once = decodeSlideOperation(sample);
    const twice = decodeSlideOperation(once);
    assert.deepEqual(twice, once);
    assert.deepEqual(once, sample);
  }
});

test("an optional is either absent or a value, never an explicit undefined", () => {
  // This matters to the reducer, which distinguishes "no parent" from "parent
  // set", and to the canonical digest, which drops undefined and so would hash
  // two structurally different operations identically.
  //
  // The guarantee comes from the wire-input assert rejecting `undefined` as a
  // non-JSON value, not from the per-field decoding — a distinction worth
  // pinning, because JSON over HTTP cannot carry `undefined` but an in-process
  // caller can.
  rejects(
    () =>
      decodeSlideOperation({
        type: "element.reorder",
        container: SLIDE,
        elementId: "element-1",
        parentGroupId: undefined,
        zIndex: 2
      }),
    /parentGroupId must contain only JSON values/
  );
  rejects(
    () =>
      decodeSlideOperation({
        type: "element.insert",
        container: SLIDE,
        element: { ...textElement(), styleId: undefined }
      }),
    /styleId must contain only JSON values/
  );

  // An omitted optional stays omitted through the decode.
  const decoded = decodeSlideOperation({
    type: "element.reorder",
    container: SLIDE,
    elementId: "element-1",
    zIndex: 2
  });
  assert.ok(!Object.prototype.hasOwnProperty.call(decoded, "parentGroupId"));
  assert.deepEqual(Object.keys(decoded).sort(), [
    "container", "elementId", "type", "zIndex"
  ]);
});
