import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultSlideStyles,
  DEFAULT_SLIDE_CANVAS
} from "../../src/3-capabilities/slide/application/createService.js";
import type { SlideInternalJobIntent } from "../../src/3-capabilities/slide/domain/model.js";
import { decodeSlideCommand } from "../../src/3-capabilities/slide/wire/commandSchemas.js";
import {
  decodeSlideOperation,
  decodeSlideOperations,
  SLIDE_WIRE_LIMITS,
  SlideWireError
} from "../../src/3-capabilities/slide/wire/operationSchemas.js";
import { decodeSlideQuery } from "../../src/3-capabilities/slide/wire/querySchemas.js";
import { createSlideInternalJob } from "../../src/4-job-wiring/slide/createSlideJobs.js";

const frame = () => ({ xPt: 10, yPt: 20, widthPt: 300, heightPt: 180 });
const transform = () => ({
  rotationDegrees: 0,
  flipHorizontal: false,
  flipVertical: false
});
const textBox = () => ({
  paddingPt: { top: 4, right: 4, bottom: 4, left: 4 },
  horizontalAlign: "left",
  verticalAlign: "top",
  overflow: "clip"
});
const textContent = () => ({
  atoms: [{ id: "atom-1", kind: "text", text: "Hello" }],
  marks: []
});
const shapeBase = (id: string, styleId = "slide-style-text") => ({
  id,
  elementKind: "shape",
  locked: false,
  hidden: false,
  frame: frame(),
  transform: transform(),
  styleId
});
const textShape = () => ({
  ...shapeBase("shape-text"),
  shapeKind: "text",
  content: textContent(),
  textBox: textBox()
});
const validSlide = () => ({
  id: "slide-2",
  title: "Details",
  background: { kind: "solid", color: "#ffffffff" },
  notes: textContent(),
  rootElementIds: ["shape-text"],
  elements: { "shape-text": textShape() }
});
const envelope = (command: unknown) => ({
  requestId: "request-1",
  origin: "interactive",
  command
});
const submit = (operations: unknown[]) => envelope({
  type: "deck.submit",
  deckId: "deck-1",
  expectedRevision: 0,
  operations
});

const rejectsWire = (work: () => unknown, pattern?: RegExp): void => {
  assert.throws(work, (error) => {
    assert.ok(error instanceof SlideWireError);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
};

test("strict Slide command decoding accepts complete canvas, styles, shapes, and Rich Text DTOs", () => {
  const input = envelope({
    type: "deck.create",
    deckId: "deck-1",
    title: "Quarterly plan",
    initialSlideId: "slide-1",
    canvas: structuredClone(DEFAULT_SLIDE_CANVAS),
    styles: createDefaultSlideStyles()
  });
  const created = decodeSlideCommand(input);
  assert.equal(created.command.type, "deck.create");

  const operations = [
    { type: "slide.insert", slide: validSlide(), afterSlideId: "slide-1" },
    {
      type: "text.apply",
      slideId: "slide-2",
      shapeId: "shape-text",
      operations: [{
        type: "replace-range-with-atom",
        range: {
          start: { atomId: "atom-1", offset: 0 },
          end: { atomId: "atom-1", offset: 5 }
        },
        expectedText: "Hello",
        atom: {
          id: "formula-1",
          kind: "formula",
          expression: "1 + 1",
          acceptedValue: { kind: "number", numerator: "2", denominator: "1" },
          displayText: "2"
        }
      }]
    },
    {
      type: "shape.insert",
      slideId: "slide-2",
      shape: {
        ...shapeBase("shape-chart", "slide-style-chart"),
        shapeKind: "chart",
        chart: {
          accepted: {
            value: {
              kind: "table",
              fields: ["label", "value"],
              rows: [[
                { kind: "text", value: "A" },
                { kind: "number", numerator: "10", denominator: "1" }
              ]]
            }
          },
          specification: {
            kind: "bar",
            title: "Results",
            legend: { position: "bottom" },
            colors: ["#3366ffff"]
          }
        }
      },
      placement: { afterElementId: "shape-text" }
    }
  ];
  const decoded = decodeSlideCommand(submit(operations));
  assert.equal(decoded.command.type, "deck.submit");
  if (decoded.command.type === "deck.submit") {
    assert.equal(decoded.command.operations.length, 3);
  }

  (input.command as { canvas: { widthPt: number } }).canvas.widthPt = 1;
  if (created.command.type === "deck.create") {
    assert.equal(created.command.canvas?.widthPt, DEFAULT_SLIDE_CANVAS.widthPt);
  }
});

test("unknown fields are rejected at every recursive Slide boundary", () => {
  const cases: Array<[unknown, RegExp]> = [
    [{
      type: "shape.insert",
      slideId: "slide-1",
      shape: { ...textShape(), frame: { ...frame(), surprise: true } },
      placement: {}
    }, /frame contains unknown fields: surprise/],
    [{
      type: "style.create",
      style: {
        id: "style-1",
        name: "Style",
        visual: { fill: { kind: "solid", color: "#ffffffff", surprise: true } },
        text: {}
      }
    }, /fill contains unknown fields: surprise/],
    [{
      type: "text.apply",
      slideId: "slide-1",
      shapeId: "shape-text",
      operations: [{
        type: "insert-text",
        at: { atomId: "atom-1", offset: 0, surprise: true },
        text: "x"
      }]
    }, /at contains unknown fields: surprise/],
    [{
      type: "slide.insert",
      slide: {
        ...validSlide(),
        elements: {
          "shape-text": {
            ...textShape(),
            content: {
              atoms: [{ id: "atom-1", kind: "text", text: "Hello", surprise: true }],
              marks: []
            }
          }
        }
      }
    }, /atoms\[0\] contains unknown fields: surprise/]
  ];
  for (const [value, pattern] of cases) {
    rejectsWire(() => decodeSlideOperation(value), pattern);
  }

  rejectsWire(() => decodeSlideCommand(envelope({
    type: "prompt-content.create.request",
    deckId: "deck-1",
    expectedRevision: 0,
    slideId: "slide-1",
    shapeId: "shape-prompt",
    frame: frame(),
    styleId: "slide-style-text",
    textBox: textBox(),
    placement: {},
    prompt: "Summarise",
    contextEntries: [{ id: "resource-1", kind: "document", surprise: true }],
    stabilisationText: ""
  })), /contextEntries\[0\] contains unknown fields: surprise/);
});

test("invalid primitives, discriminants, geometry, colors, crops, and Formula values are rejected", () => {
  const cases: Array<[unknown, RegExp]> = [
    [{ type: "deck.rename" }, /title must be/],
    [{ type: "deck.set-lifecycle", lifecycle: "deleted" }, /lifecycle must be one of/],
    [{ type: "not-an-operation" }, /Unknown Slide operation/],
    [{ type: "deck.set-canvas", canvas: { widthPt: 0, heightPt: 540 } }, /widthPt must be positive/],
    [{
      type: "shape.set-transform",
      slideId: "slide-1",
      shapeId: "shape-1",
      transform: { ...transform(), rotationDegrees: 360 }
    }, /rotationDegrees must be in/],
    [{
      type: "slide.set-background",
      slideId: "slide-1",
      background: { kind: "solid", color: "#FFFFFFff" }
    }, /canonical lowercase/],
    [{
      type: "image.set",
      slideId: "slide-1",
      shapeId: "shape-image",
      image: {
        source: { fileId: "file-1", version: "1", digest: "sha", mimeType: "image/png" },
        crop: { left: 0.6, right: 0.5, top: 0, bottom: 0 },
        fit: "cover",
        alt: "",
        decorative: true
      }
    }, /horizontal crop must leave positive width/],
    [{
      type: "image.set",
      slideId: "slide-1",
      shapeId: "shape-image",
      image: {
        source: { fileId: "file-1", version: "1", digest: "sha", mimeType: "text/plain" },
        fit: "contain",
        alt: "Image",
        decorative: false
      }
    }, /mimeType must start with image/],
    [{
      type: "line.set",
      slideId: "slide-1",
      shapeId: "shape-line",
      line: {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        startDecoration: "none",
        endDecoration: "none"
      }
    }, /endpoints must differ/],
    [{
      type: "style.create",
      style: {
        id: "style-1",
        name: "Style",
        visual: {
          stroke: {
            kind: "stroke",
            color: "#000000ff",
            widthPt: 0,
            dash: "solid"
          }
        },
        text: {}
      }
    }, /widthPt must be positive/],
    [{
      type: "table.set",
      slideId: "slide-1",
      shapeId: "shape-table",
      table: {
        accepted: { value: { kind: "number", numerator: "1", denominator: "0" } },
        presentation: {
          headerRow: false,
          bandedRows: false,
          firstColumnHeader: false,
          lastColumnFooter: false
        }
      }
    }, /denominator must be a positive integer string/],
    [{
      type: "table.set",
      slideId: "slide-1",
      shapeId: "shape-table",
      table: {
        accepted: { value: { kind: "number", numerator: "1", denominator: "1" } },
        presentation: {
          headerRow: false,
          bandedRows: false,
          firstColumnHeader: false,
          lastColumnFooter: false
        }
      }
    }, /must be a table value/],
    [{
      type: "chart.set",
      slideId: "slide-1",
      shapeId: "shape-chart",
      chart: {
        accepted: { value: { kind: "text", value: "not tabular" } },
        specification: { kind: "bar", legend: { position: "none" } }
      }
    }, /must be a list, record, or table value/]
  ];
  for (const [value, pattern] of cases) {
    rejectsWire(() => decodeSlideOperation(value), pattern);
  }

  rejectsWire(() => decodeSlideCommand(envelope({
    type: "deck.submit",
    deckId: "deck-1",
    expectedRevision: Number.NaN,
    operations: [{ type: "deck.rename", title: "Next" }]
  })), /must be finite/);

  for (const reserved of ["__proto__", "constructor", "toString", "prototype"]) {
    rejectsWire(() => decodeSlideCommand(envelope({
      type: "deck.create",
      deckId: "deck-1",
      title: "Deck",
      initialSlideId: reserved
    })), /reserved record key/);
  }

  const styles = createDefaultSlideStyles();
  styles.defaultStyleIdByShapeKind.chart = "missing-style";
  rejectsWire(() => decodeSlideCommand(envelope({
    type: "deck.create",
    deckId: "deck-1",
    title: "Deck",
    initialSlideId: "slide-1",
    styles
  })), /must resolve to a Style/);
});

test("the public command decoder reserves Prompt Content output adoption for internal workflows", () => {
  const restored = decodeSlideOperation({
    type: "element.restore-subtree",
    slideId: "slide-1",
    rootElementId: "group-restored",
    elements: [{
      id: "group-restored",
      elementKind: "group",
      locked: false,
      hidden: false,
      childElementIds: ["shape-existing"]
    }],
    placement: {},
    adoptedElementId: "shape-existing"
  });
  assert.equal(restored.type, "element.restore-subtree");
  if (restored.type === "element.restore-subtree") {
    assert.equal(restored.adoptedElementId, "shape-existing");
  }

  rejectsWire(() => decodeSlideCommand(submit([restored])), /internal-only operation/);

  rejectsWire(() => decodeSlideCommand(submit([{
    type: "prompt-content.apply-derived-output",
    slideId: "slide-1",
    shapeId: "shape-prompt",
    output: { outputId: "output-1", appliedRevision: 1 }
  }])), /internal-only operation/);

  rejectsWire(() => decodeSlideCommand(submit([{
    type: "shape.insert",
    slideId: "slide-1",
    shape: {
      ...shapeBase("shape-prompt"),
      shapeKind: "prompt-content",
      output: { outputId: "output-1", appliedRevision: 1 },
      textBox: textBox()
    },
    placement: {}
  }])), /must be created through prompt-content.create.request/);

  const slide = validSlide() as ReturnType<typeof validSlide> & {
    rootElementIds: string[];
    elements: Record<string, unknown>;
  };
  slide.rootElementIds.push("shape-prompt");
  slide.elements["shape-prompt"] = {
    ...shapeBase("shape-prompt"),
    shapeKind: "prompt-content",
    output: { outputId: "output-1", appliedRevision: 1 },
    textBox: textBox()
  };
  rejectsWire(() => decodeSlideCommand(submit([{
    type: "slide.insert",
    slide,
    afterSlideId: "slide-1"
  }])), /must be created through prompt-content.create.request/);
});

test("Slide wire budgets reject excessive operations, nesting, strings, cycles, and payload bytes", () => {
  const rename = { type: "deck.rename", title: "x" };
  rejectsWire(
    () => decodeSlideOperations(Array.from(
      { length: SLIDE_WIRE_LIMITS.maxOperations + 1 },
      () => rename
    )),
    /collection limit/
  );
  rejectsWire(() => decodeSlideCommand(envelope({
    type: "deck.create",
    deckId: "deck-1",
    title: "x".repeat(SLIDE_WIRE_LIMITS.maxStringBytes + 1),
    initialSlideId: "slide-1"
  })), /string size limit/);

  let nested: Record<string, unknown> = {};
  for (let depth = 0; depth < SLIDE_WIRE_LIMITS.maxDepth + 2; depth += 1) {
    nested = { child: nested };
  }
  rejectsWire(() => decodeSlideOperation({
    type: "chart.set",
    slideId: "slide-1",
    shapeId: "shape-chart",
    chart: nested
  }), /nesting limit/);

  const cyclic: Record<string, unknown> = { type: "deck.rename", title: "Next" };
  cyclic.self = cyclic;
  rejectsWire(() => decodeSlideOperation(cyclic), /must not be cyclic/);

  const groupElements: Record<string, unknown> = {};
  for (let depth = 0; depth <= SLIDE_WIRE_LIMITS.maxGroupDepth; depth += 1) {
    groupElements[`group-${depth}`] = {
      id: `group-${depth}`,
      elementKind: "group",
      locked: false,
      hidden: false,
      childElementIds: depth === SLIDE_WIRE_LIMITS.maxGroupDepth
        ? ["shape-text"]
        : [`group-${depth + 1}`]
    };
  }
  groupElements["shape-text"] = textShape();
  rejectsWire(() => decodeSlideOperation({
    type: "slide.insert",
    slide: {
      ...validSlide(),
      rootElementIds: ["group-0"],
      elements: groupElements
    }
  }), /Group depth limit/);

  rejectsWire(() => decodeSlideOperation({
    type: "slide.insert",
    slide: {
      ...validSlide(),
      rootElementIds: ["group-a"],
      elements: {
        "group-a": {
          id: "group-a",
          elementKind: "group",
          locked: false,
          hidden: false,
          childElementIds: ["group-b"]
        },
        "group-b": {
          id: "group-b",
          elementKind: "group",
          locked: false,
          hidden: false,
          childElementIds: ["group-a"]
        }
      }
    }
  }), /Group cycle/);

  const chunk = "x".repeat(220_000);
  rejectsWire(() => decodeSlideCommand(submit(Array.from({ length: 5 }, () => ({
    type: "deck.rename",
    title: chunk
  })))), /payload size limit/);
});

test("Slide query decoding is strict and bounds history pages", () => {
  assert.deepEqual(decodeSlideQuery({
    requestId: "request-1",
    query: { type: "deck.list", lifecycle: "active", cursor: "cursor-1" }
  }), {
    requestId: "request-1",
    query: { type: "deck.list", lifecycle: "active", cursor: "cursor-1" }
  });
  rejectsWire(() => decodeSlideQuery({
    requestId: "request-1",
    query: { type: "deck.history", deckId: "deck-1", limit: 0 }
  }), /between 1 and 1000/);
  rejectsWire(() => decodeSlideQuery({
    requestId: "request-1",
    query: { type: "deck.load", deckId: "deck-1", unknown: true }
  }), /contains unknown fields: unknown/);
});

test("Slide internal Jobs keep compute concurrent and mutation stages serial", async () => {
  const calls: string[] = [];
  const slide = {
    compact: async (deckId: string) => calls.push(`compact:${deckId}`),
    computePromptCreation: async (attemptId: string) => calls.push(`create-compute:${attemptId}`),
    settlePromptCreation: async (attemptId: string) => calls.push(`create-settle:${attemptId}`),
    computePromptRefresh: async (attemptId: string) => calls.push(`refresh-compute:${attemptId}`),
    settlePromptRefresh: async (attemptId: string) => calls.push(`refresh-settle:${attemptId}`)
  } as unknown as Parameters<typeof createSlideInternalJob>[0];
  const intents: SlideInternalJobIntent[] = [
    { type: "slide.compact", deckId: "deck-1", idempotencyKey: "compact-1" },
    {
      type: "slide.prompt-content.create.compute",
      attemptId: "attempt-1",
      idempotencyKey: "create-compute-1"
    },
    {
      type: "slide.prompt-content.create.settle",
      attemptId: "attempt-1",
      idempotencyKey: "create-settle-1"
    },
    {
      type: "slide.prompt-content.refresh.compute",
      attemptId: "attempt-2",
      idempotencyKey: "refresh-compute-1"
    },
    {
      type: "slide.prompt-content.refresh.settle",
      attemptId: "attempt-2",
      idempotencyKey: "refresh-settle-1"
    }
  ];

  const definitions = intents.map((intent) => createSlideInternalJob(slide, intent));
  assert.deepEqual(
    definitions.map((definition) => definition.queueType),
    ["serial", "concurrent", "serial", "concurrent", "serial"]
  );
  assert.deepEqual(
    definitions.map((definition) => definition.name),
    [
      "slides.compact",
      "slides.prompt-content.create.compute",
      "slides.prompt-content.create.settle",
      "slides.prompt-content.refresh.compute",
      "slides.prompt-content.refresh.settle"
    ]
  );
  for (const definition of definitions) await definition.work();
  assert.deepEqual(calls, [
    "compact:deck-1",
    "create-compute:attempt-1",
    "create-settle:attempt-1",
    "refresh-compute:attempt-2",
    "refresh-settle:attempt-2"
  ]);
});
