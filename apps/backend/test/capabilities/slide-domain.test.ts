import assert from "node:assert/strict";
import test from "node:test";
import {
  createRichText,
  DEFAULT_CONFIG,
  type RichContent
} from "../../src/0-platform/rich-text/index.js";
import {
  createBlankDeckSnapshot,
  createDefaultSlideStyles,
  DEFAULT_SLIDE_OPTIONS
} from "../../src/3-capabilities/slide/application/createService.js";
import { canonicalizeSnapshot } from "../../src/3-capabilities/slide/domain/canonical.js";
import {
  SlideOperationError,
  SlidePlacementError,
  SlideValidationError
} from "../../src/3-capabilities/slide/domain/errors.js";
import {
  computeGroupBounds,
  expandGroupTransform
} from "../../src/3-capabilities/slide/domain/geometry.js";
import {
  collectSlideIdentities,
  computeSlideIdentityTransitions
} from "../../src/3-capabilities/slide/domain/identities.js";
import type {
  DeckSnapshot,
  GeometryShape,
  PromptContentShape,
  Slide,
  SlideChangeSet,
  SlideElement,
  SlideOperation,
  TextShape
} from "../../src/3-capabilities/slide/domain/model.js";
import {
  applyOperations,
  computeTouchedIds,
  resolveShapeStyle
} from "../../src/3-capabilities/slide/domain/reducer.js";
import { canRebase } from "../../src/3-capabilities/slide/domain/rebase.js";
import {
  DECK_SLIDES_CONTAINER_ID,
  DECK_STYLES_CONTAINER_ID,
  groupChildrenContainerId,
  operationIntroducesPromptContent,
  slideRootContainerId
} from "../../src/3-capabilities/slide/domain/tree.js";
import { validateSnapshot } from "../../src/3-capabilities/slide/domain/validation.js";
import { CapturingLogger } from "../helpers/testDoubles.js";

const SLIDE_ID = "slide-1";
const TEXT_STYLE = "slide-style-text";
const GEOMETRY_STYLE = "slide-style-geometry";
const LIMITS = DEFAULT_SLIDE_OPTIONS.limits;
const richText = () => createRichText(DEFAULT_CONFIG, new CapturingLogger());

const content = (atomId: string, text: string): RichContent => ({
  atoms: [{ id: atomId, kind: "text", text }],
  marks: []
});

const textShape = (id: string, text = id): TextShape => ({
  id,
  elementKind: "shape",
  shapeKind: "text",
  locked: false,
  hidden: false,
  frame: { xPt: 0, yPt: 0, widthPt: 100, heightPt: 40 },
  transform: { rotationDegrees: 0, flipHorizontal: false, flipVertical: false },
  styleId: TEXT_STYLE,
  content: content(`${id}-atom`, text),
  textBox: {
    paddingPt: { top: 2, right: 2, bottom: 2, left: 2 },
    horizontalAlign: "left",
    verticalAlign: "top",
    overflow: "clip"
  }
});

const geometryShape = (
  id: string,
  xPt = 0,
  hidden = false
): GeometryShape => ({
  id,
  elementKind: "shape",
  shapeKind: "geometry",
  locked: false,
  hidden,
  frame: { xPt, yPt: 0, widthPt: 10, heightPt: 10 },
  transform: { rotationDegrees: 0, flipHorizontal: false, flipVertical: false },
  styleId: GEOMETRY_STYLE,
  geometry: { kind: "rectangle" }
});

const promptShape = (id: string, outputId: string): PromptContentShape => ({
  id,
  elementKind: "shape",
  shapeKind: "prompt-content",
  locked: false,
  hidden: false,
  frame: { xPt: 0, yPt: 0, widthPt: 200, heightPt: 100 },
  transform: { rotationDegrees: 0, flipHorizontal: false, flipVertical: false },
  styleId: TEXT_STYLE,
  output: { outputId, appliedRevision: 1 },
  textBox: {
    paddingPt: { top: 4, right: 4, bottom: 4, left: 4 },
    horizontalAlign: "left",
    verticalAlign: "top",
    overflow: "shrink"
  }
});

const blank = (): DeckSnapshot => createBlankDeckSnapshot({
  title: "Domain deck",
  initialSlideId: SLIDE_ID
});

const withElements = (...elements: SlideElement[]): DeckSnapshot => {
  const snapshot = blank();
  snapshot.slides[SLIDE_ID].rootElementIds = elements.map((element) => element.id);
  snapshot.slides[SLIDE_ID].elements = Object.fromEntries(
    elements.map((element) => [element.id, structuredClone(element)])
  );
  return snapshot;
};

const roundTrip = (
  snapshot: DeckSnapshot,
  operations: SlideOperation[]
): ReturnType<typeof applyOperations> => {
  const runtime = richText();
  const changed = applyOperations(snapshot, operations, runtime, LIMITS);
  const undone = applyOperations(changed.snapshot, changed.inverse, runtime, LIMITS);
  assert.deepEqual(undone.snapshot, snapshot);
  const redone = applyOperations(undone.snapshot, undone.inverse, runtime, LIMITS);
  assert.deepEqual(redone.snapshot, changed.snapshot);
  return changed;
};

test("blank Deck uses one canvas, one Slide, and a complete embedded Style Registry", () => {
  const snapshot = blank();
  assert.deepEqual(snapshot.canvas, { widthPt: 960, heightPt: 540 });
  assert.deepEqual(snapshot.slideOrder, [SLIDE_ID]);
  assert.equal(validateSnapshot(snapshot, richText(), LIMITS).ok, true);
  assert.equal(Object.keys(snapshot.styles.defaultStyleIdByShapeKind).length, 7);
  assert.equal(
    snapshot.styles.styles.find((style) => style.id === TEXT_STYLE)?.text.fontWeight,
    undefined,
    "default text must leave fontWeight supplementary so inline bold can apply"
  );
  assert.throws(
    () => applyOperations(snapshot, [{ type: "slide.delete", slideId: SLIDE_ID }], richText(), LIMITS),
    /retain at least one Slide/
  );
});

test("canonical encoding is independent of Record key insertion order", () => {
  const first = withElements(textShape("a"), geometryShape("b"));
  const second = structuredClone(first);
  second.slides[SLIDE_ID].elements = {
    b: second.slides[SLIDE_ID].elements.b,
    a: second.slides[SLIDE_ID].elements.a
  };
  assert.deepEqual(canonicalizeSnapshot(first), canonicalizeSnapshot(second));
});

test("Group creation requires contiguous siblings and exact inverse preserves ordering", () => {
  const snapshot = withElements(textShape("a"), textShape("b"), textShape("c"));
  const changed = roundTrip(snapshot, [{
    type: "group.create",
    slideId: SLIDE_ID,
    group: {
      id: "group",
      elementKind: "group",
      locked: false,
      hidden: false,
      childElementIds: ["a", "b"]
    }
  }]);
  assert.deepEqual(changed.snapshot.slides[SLIDE_ID].rootElementIds, ["group", "c"]);
  assert.deepEqual(
    (changed.snapshot.slides[SLIDE_ID].elements.group as { childElementIds: string[] }).childElementIds,
    ["a", "b"]
  );

  assert.throws(
    () => applyOperations(snapshot, [{
      type: "group.create",
      slideId: SLIDE_ID,
      group: {
        id: "bad-group",
        elementKind: "group",
        locked: false,
        hidden: false,
        childElementIds: ["a", "c"]
      }
    }], richText(), LIMITS),
    (error) => error instanceof SlidePlacementError && /contiguous/.test(error.message)
  );
});

test("moving or deleting a final Group child prunes empty ancestor Groups with exact redo", () => {
  const leaf = textShape("leaf");
  const sibling = textShape("sibling");
  const group: SlideElement = {
    id: "group",
    elementKind: "group",
    locked: false,
    hidden: false,
    childElementIds: [leaf.id]
  };
  const movedSource = withElements(group, sibling);
  movedSource.slides[SLIDE_ID].elements[leaf.id] = leaf;
  const moved = roundTrip(movedSource, [{
    type: "element.move",
    slideId: SLIDE_ID,
    elementId: leaf.id,
    placement: { afterElementId: sibling.id }
  }]);
  assert.deepEqual(moved.snapshot.slides[SLIDE_ID].rootElementIds, [sibling.id, leaf.id]);
  assert.equal(moved.snapshot.slides[SLIDE_ID].elements.group, undefined);

  const deletedSource = structuredClone(movedSource);
  const deleted = roundTrip(deletedSource, [{
    type: "element.delete",
    slideId: SLIDE_ID,
    elementId: leaf.id
  }]);
  assert.deepEqual(deleted.snapshot.slides[SLIDE_ID].rootElementIds, [sibling.id]);
  assert.equal(deleted.snapshot.slides[SLIDE_ID].elements.group, undefined);
  assert.equal(deleted.snapshot.slides[SLIDE_ID].elements.leaf, undefined);
});

test("element placement rejects a Group moving into its own descendant", () => {
  const leaf = geometryShape("leaf");
  const inner: SlideElement = {
    id: "inner",
    elementKind: "group",
    locked: false,
    hidden: false,
    childElementIds: [leaf.id]
  };
  const outer: SlideElement = {
    id: "outer",
    elementKind: "group",
    locked: false,
    hidden: false,
    childElementIds: [inner.id]
  };
  const snapshot = withElements(outer);
  Object.assign(snapshot.slides[SLIDE_ID].elements, { inner, leaf });
  assert.throws(
    () => applyOperations(snapshot, [{
      type: "element.move",
      slideId: SLIDE_ID,
      elementId: outer.id,
      placement: { parentGroupId: inner.id }
    }], richText(), LIMITS),
    (error) => error instanceof SlidePlacementError && /descendant/.test(error.message)
  );
});

test("disconnected closed Group cycles fail reachability and cycle validation", () => {
  const snapshot = blank();
  snapshot.slides[SLIDE_ID].elements = {
    first: {
      id: "first",
      elementKind: "group",
      locked: false,
      hidden: false,
      childElementIds: ["second"]
    },
    second: {
      id: "second",
      elementKind: "group",
      locked: false,
      hidden: false,
      childElementIds: ["first"]
    }
  };
  const result = validateSnapshot(snapshot, richText(), LIMITS);
  assert.equal(result.ok, false);
  assert(result.diagnostics.some((item) => /not reachable/.test(item)));
  assert(result.diagnostics.some((item) => /cycle/.test(item)));
});

test("Style inheritance validates and style deletion restores references exactly", () => {
  const shape = textShape("text");
  const snapshot = withElements(shape);
  snapshot.styles.styles.push({
    id: "custom",
    name: "Custom",
    basedOnStyleId: TEXT_STYLE,
    visual: {},
    text: { italic: true }
  });
  snapshot.slides[SLIDE_ID].elements.text = { ...shape, styleId: "custom" };
  roundTrip(snapshot, [{
    type: "style.delete",
    styleId: "custom",
    replacementStyleId: TEXT_STYLE
  }]);

  const cyclic = structuredClone(snapshot);
  cyclic.styles.styles.find((style) => style.id === TEXT_STYLE)!.basedOnStyleId = "custom";
  assert(validateSnapshot(cyclic, richText(), LIMITS).diagnostics.some((item) => /inheritance cycle/.test(item)));
  assert.equal(resolveShapeStyle(snapshot, snapshot.slides[SLIDE_ID].elements.text as TextShape).text.italic, true);
});

test("authored text operations use Rich Text exact inverses and invalid content is rejected", () => {
  const snapshot = withElements(textShape("text", "Hello"));
  const changed = roundTrip(snapshot, [{
    type: "text.apply",
    slideId: SLIDE_ID,
    shapeId: "text",
    operations: [{
      type: "insert-text",
      at: { atomId: "text-atom", offset: 5 },
      text: " world"
    }]
  }]);
  assert.equal(
    (changed.snapshot.slides[SLIDE_ID].elements.text as TextShape).content.atoms[0].kind === "text" &&
      ((changed.snapshot.slides[SLIDE_ID].elements.text as TextShape).content.atoms[0] as { text: string }).text,
    "Hello world"
  );

  const invalid = withElements(textShape("invalid"));
  (invalid.slides[SLIDE_ID].elements.invalid as TextShape).content = { atoms: [], marks: [] };
  assert(validateSnapshot(invalid, richText(), LIMITS).diagnostics.some((item) => /at least one entry/.test(item)));
});

test("literal Table and Chart accepted values are type-checked and bounded", () => {
  const table: SlideElement = {
    ...geometryShape("table"),
    shapeKind: "table",
    styleId: "slide-style-table",
    table: {
      accepted: {
        value: {
          kind: "table",
          fields: ["name", "value"],
          rows: [[{ kind: "text", value: "A" }, { kind: "number", numerator: "1", denominator: "1" }]]
        }
      },
      presentation: {
        headerRow: true,
        bandedRows: false,
        firstColumnHeader: false,
        lastColumnFooter: false,
        columnWidthsPt: [40, 60]
      }
    }
  };
  assert.equal(validateSnapshot(withElements(table), richText(), LIMITS).ok, true);

  const invalid = structuredClone(table) as Extract<SlideElement, { shapeKind: "table" }>;
  invalid.table.accepted.value = { kind: "text", value: "not tabular" };
  assert(validateSnapshot(withElements(invalid), richText(), LIMITS).diagnostics.some((item) => /requires a table value/.test(item)));
});

test("Prompt Content is dedicated, exact, and detectable at the generic-operation boundary", () => {
  const first = promptShape("prompt-a", "output");
  const second = promptShape("prompt-b", "output");
  const duplicate = withElements(first, second);
  assert(validateSnapshot(duplicate, richText(), LIMITS).diagnostics.some((item) => /shared by live Prompt/.test(item)));
  assert.equal(operationIntroducesPromptContent({
    type: "shape.insert",
    slideId: SLIDE_ID,
    shape: first,
    placement: {}
  }), true);

  const snapshot = withElements(promptShape("prompt", "output"));
  const changed = roundTrip(snapshot, [{
    type: "prompt-content.apply-derived-output",
    slideId: SLIDE_ID,
    shapeId: "prompt",
    output: { outputId: "output", appliedRevision: 2 }
  }]);
  assert.equal((changed.snapshot.slides[SLIDE_ID].elements.prompt as PromptContentShape).output.appliedRevision, 2);
  assert.throws(
    () => applyOperations(snapshot, [{
      type: "prompt-content.apply-derived-output",
      slideId: SLIDE_ID,
      shapeId: "prompt",
      output: { outputId: "other", appliedRevision: 2 }
    }], richText(), LIMITS),
    /cannot adopt another/
  );
});

test("identity collection and transitions include structural and Rich Text identities", () => {
  const source = withElements(textShape("text"));
  const identities = collectSlideIdentities(source);
  assert(identities.some((identity) => identity.kind === "slide" && identity.id === SLIDE_ID));
  assert(identities.some((identity) => identity.kind === "shape" && identity.id === "text"));
  assert(identities.some((identity) => identity.kind === "rich-text-atom" && identity.id === "text-atom"));

  const changed = applyOperations(source, [{
    type: "element.delete",
    slideId: SLIDE_ID,
    elementId: "text"
  }], richText(), LIMITS).snapshot;
  const transitions = computeSlideIdentityTransitions(source, changed);
  assert(transitions.removed.some((identity) => identity.id === "text"));
  assert(transitions.removed.some((identity) => identity.id === "text-atom"));
});

test("ordinary batches reject same-ID delete/reinsert and Rich Text identity churn", () => {
  const source = withElements(textShape("same", "text"));
  assert.throws(
    () => applyOperations(source, [
      { type: "element.delete", slideId: SLIDE_ID, elementId: "same" },
      { type: "shape.insert", slideId: SLIDE_ID, shape: geometryShape("same"), placement: {} }
    ], richText(), LIMITS),
    (error) => error instanceof SlideOperationError && /re-added/.test(error.message)
  );

  assert.throws(
    () => applyOperations(source, [{
      type: "text.apply",
      slideId: SLIDE_ID,
      shapeId: "same",
      operations: [
        { type: "delete-atom", atomId: "same-atom" },
        { type: "insert-atom", at: { atomId: "same-atom", offset: 0 }, atom: { id: "same-atom", kind: "text", text: "new" } }
      ]
    }], richText(), LIMITS),
    /cannot be re-added/
  );
});

test("unsafe inherited-property identities are rejected before Record lookup", () => {
  assert.throws(
    () => createBlankDeckSnapshot({ title: "Unsafe", initialSlideId: "constructor" }),
    (error) => error instanceof SlideValidationError && /safe record key/.test(error.message)
  );
  const unsafe = blank();
  unsafe.slideOrder = ["toString"];
  assert.doesNotThrow(() => validateSnapshot(unsafe, richText(), LIMITS));
  assert(validateSnapshot(unsafe, richText(), LIMITS).diagnostics.some((item) => /safe record key|missing Slide/.test(item)));
});

test("touched IDs include ordering and descendant Group-container sentinels", () => {
  const leaf = geometryShape("leaf");
  const group: SlideElement = {
    id: "group",
    elementKind: "group",
    locked: false,
    hidden: false,
    childElementIds: [leaf.id]
  };
  const source = withElements(group);
  source.slides[SLIDE_ID].elements.leaf = leaf;
  const deleteTouched = computeTouchedIds(source, [{
    type: "element.delete",
    slideId: SLIDE_ID,
    elementId: "group"
  }]);
  assert(deleteTouched.includes(slideRootContainerId(SLIDE_ID)));
  assert(deleteTouched.includes(groupChildrenContainerId("group")));

  const ungroupTouched = computeTouchedIds(source, [{
    type: "group.ungroup",
    slideId: SLIDE_ID,
    groupId: "group"
  }]);
  assert(ungroupTouched.includes(groupChildrenContainerId("group")));

  const slideTouched = computeTouchedIds(source, [{
    type: "slide.insert",
    slide: { ...blank().slides[SLIDE_ID], id: "slide-2", notes: content("slide-2-notes", "") },
    afterSlideId: SLIDE_ID
  }]);
  assert(slideTouched.includes(DECK_SLIDES_CONTAINER_ID));
  assert(computeTouchedIds(source, [{
    type: "style.create",
    style: { id: "new-style", name: "New", visual: {}, text: {} }
  }]).includes(DECK_STYLES_CONTAINER_ID));
});

test("style deletion touches inheriting Styles and conflicts with their stale updates", () => {
  const source = blank();
  source.styles.styles.push({
    id: "parent",
    name: "Parent",
    visual: {},
    text: {}
  }, {
    id: "child",
    name: "Child",
    basedOnStyleId: "parent",
    visual: {},
    text: {}
  });
  const touched = computeTouchedIds(source, [{
    type: "style.delete",
    styleId: "parent",
    replacementStyleId: TEXT_STYLE
  }]);
  assert(touched.includes("child"));
  const intervening: SlideChangeSet = {
    id: "change",
    deckId: "deck",
    clientRequestId: "request",
    requestDigest: "digest",
    authoredRevision: 0,
    priorRevision: 0,
    revision: 1,
    seq: 1,
    origin: "interactive",
    operations: [],
    inverseOperations: [],
    touchedIds: ["child"],
    semanticDigest: "digest",
    createdAt: new Date(0).toISOString()
  };
  assert.deepEqual(canRebase(touched, [intervening]), { allowed: false, conflictingIds: ["child"] });
});

test("Group bounds include hidden descendants and transform expansion emits Shape operations only", () => {
  const visible = geometryShape("visible", 0);
  const hidden = geometryShape("hidden", 20, true);
  const group: SlideElement = {
    id: "group",
    elementKind: "group",
    locked: false,
    hidden: false,
    childElementIds: [visible.id, hidden.id]
  };
  const snapshot = withElements(group);
  Object.assign(snapshot.slides[SLIDE_ID].elements, { visible, hidden });
  assert.deepEqual(computeGroupBounds(snapshot.slides[SLIDE_ID], "group"), {
    xPt: 0,
    yPt: 0,
    widthPt: 30,
    heightPt: 10
  });
  const operations = expandGroupTransform(snapshot, SLIDE_ID, "group", { translateXPt: 5 });
  assert.equal(operations.length, 4);
  assert(operations.every((operation) =>
    operation.type === "shape.set-frame" || operation.type === "shape.set-transform"));
  const frameOps = operations.filter((operation): operation is Extract<SlideOperation, { type: "shape.set-frame" }> =>
    operation.type === "shape.set-frame");
  assert.deepEqual(frameOps.map((operation) => operation.frame.xPt), [5, 25]);
});

test("empty Groups, invalid frames, malformed images, and external-value sources fail validation", () => {
  const emptyGroup: SlideElement = {
    id: "empty",
    elementKind: "group",
    locked: false,
    hidden: false,
    childElementIds: []
  };
  assert(validateSnapshot(withElements(emptyGroup), richText(), LIMITS).diagnostics.some((item) => /must not be empty/.test(item)));

  const invalidFrame = geometryShape("bad-frame");
  invalidFrame.frame.widthPt = Number.NaN;
  assert(validateSnapshot(withElements(invalidFrame), richText(), LIMITS).diagnostics.some((item) => /frame/.test(item)));

  const styles = createDefaultSlideStyles();
  styles.defaultStyleIdByShapeKind.image = "missing";
  const badStyles = blank();
  badStyles.styles = styles;
  assert(validateSnapshot(badStyles, richText(), LIMITS).diagnostics.some((item) => /does not resolve/.test(item)));
});
