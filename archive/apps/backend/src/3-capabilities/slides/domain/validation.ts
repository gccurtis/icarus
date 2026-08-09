import type { RichText } from "#rich-text";
import {
  allContainers,
  ancestorsOf,
  siblingsOf,
  unreachableElementIds
} from "./elements.js";
import { isCanvasValid, isFrameValid, isRotationValid } from "./geometry.js";
import type {
  BoxAppearance,
  DeckSnapshot,
  DeckTheme,
  ElementContainerRef,
  SlideBackground,
  SlideElement,
  SlideElementKind,
  SlideFill,
  SlideLimits,
  SlideStyleRegistry,
  SlideTable,
  SlideTextSource,
  ThemeValue
} from "./model.js";
import { slotAccepts } from "./presentation.js";

export const SLIDE_ELEMENT_KINDS: SlideElementKind[] = [
  "group",
  "text",
  "table",
  "chart",
  "image",
  "geometry",
  "line"
];

export interface SlideValidationResult {
  ok: boolean;
  diagnostics: string[];
}

const describeContainer = (container: ElementContainerRef): string =>
  container.kind === "slide"
    ? `Slide ${container.slideId}`
    : container.kind === "master"
      ? `Master ${container.masterId}`
      : `Layout ${container.layoutId}`;

// ── Theme ────────────────────────────────────────────────────────────────

const validateTokenReference = (
  theme: DeckTheme,
  value: ThemeValue<unknown>,
  expected: "color" | "font" | "length",
  where: string,
  diagnostics: string[]
): void => {
  if (value.kind === "literal") return;
  const token = theme.tokens[value.tokenId];
  if (!token) {
    diagnostics.push(`${where} references missing token ${value.tokenId}`);
    return;
  }
  if (token.kind !== expected) {
    diagnostics.push(
      `${where} references token ${value.tokenId} of kind ${token.kind}, expected ${expected}`
    );
  }
};

const validateTheme = (theme: DeckTheme, diagnostics: string[]): void => {
  if (!theme.name.trim()) diagnostics.push("theme must have a name");
  for (const [tokenId, token] of Object.entries(theme.tokens)) {
    if (token.id !== tokenId) {
      diagnostics.push(`token ${tokenId} is keyed by a different ID than it carries`);
    }
    if (!token.name.trim()) diagnostics.push(`token ${tokenId} must have a name`);
    if (token.kind === "length" && !Number.isFinite(token.valuePt)) {
      diagnostics.push(`token ${tokenId} must carry a finite length`);
    }
    if (token.kind === "color" && !token.value.trim()) {
      diagnostics.push(`token ${tokenId} must carry a colour`);
    }
    if (token.kind === "font" && !token.family.trim()) {
      diagnostics.push(`token ${tokenId} must carry a font family`);
    }
  }
  for (const [name, value] of Object.entries(theme.palette)) {
    validateTokenReference(theme, value, "color", `palette.${name}`, diagnostics);
  }
  validateTokenReference(
    theme,
    theme.typography.headingFontFamily,
    "font",
    "typography.headingFontFamily",
    diagnostics
  );
  validateTokenReference(
    theme,
    theme.typography.bodyFontFamily,
    "font",
    "typography.bodyFontFamily",
    diagnostics
  );
  validateTokenReference(
    theme,
    theme.typography.baseFontSizePt,
    "length",
    "typography.baseFontSizePt",
    diagnostics
  );
};

const validateFill = (
  theme: DeckTheme,
  fill: SlideFill | undefined,
  where: string,
  diagnostics: string[]
): void => {
  if (fill?.kind === "solid") {
    validateTokenReference(theme, fill.color, "color", `${where} fill`, diagnostics);
  }
};

const validateAppearance = (
  theme: DeckTheme,
  appearance: BoxAppearance | undefined,
  where: string,
  diagnostics: string[]
): void => {
  if (!appearance) return;
  validateFill(theme, appearance.fill, where, diagnostics);
  if (appearance.border) {
    if (!Number.isFinite(appearance.border.widthPt) || appearance.border.widthPt < 0) {
      diagnostics.push(`${where} border width must be a non-negative number`);
    }
    validateTokenReference(theme, appearance.border.color, "color", `${where} border`, diagnostics);
  }
};

const validateBackground = (
  theme: DeckTheme,
  background: SlideBackground | undefined,
  where: string,
  diagnostics: string[]
): void => {
  if (background?.kind === "solid") {
    validateTokenReference(theme, background.color, "color", `${where} background`, diagnostics);
  }
};

// ── Styles ───────────────────────────────────────────────────────────────

const validateStyles = (
  registry: SlideStyleRegistry,
  theme: DeckTheme,
  diagnostics: string[]
): Set<string> => {
  const ids = new Set<string>();
  let normalCount = 0;

  for (const style of registry.styles) {
    if (!style.id) diagnostics.push("style ID must be non-empty");
    if (ids.has(style.id)) diagnostics.push(`duplicate style ID: ${style.id}`);
    ids.add(style.id);
    if (!style.name.trim()) diagnostics.push(`style ${style.id} must have a name`);
    if (style.systemRole === "normal") normalCount += 1;
    validateAppearance(theme, style.box, `style ${style.id}`, diagnostics);
  }

  // `normal` is the only protected role: Document additionally protects its six
  // heading roles because outline level derives from them, and Slides has no
  // outline to derive.
  if (normalCount !== 1) diagnostics.push("exactly one normal Style is required");

  for (const style of registry.styles) {
    if (style.basedOnStyleId && !ids.has(style.basedOnStyleId)) {
      diagnostics.push(`style ${style.id} inherits missing style ${style.basedOnStyleId}`);
    }
    const seen = new Set<string>([style.id]);
    let current = style;
    while (current.basedOnStyleId) {
      if (seen.has(current.basedOnStyleId)) {
        diagnostics.push(`style ${style.id} has a cyclic inheritance chain`);
        break;
      }
      seen.add(current.basedOnStyleId);
      const next = registry.styles.find((candidate) => candidate.id === current.basedOnStyleId);
      if (!next) break;
      current = next;
    }
  }

  for (const kind of SLIDE_ELEMENT_KINDS) {
    const defaultId = registry.defaultStyleIdByElementKind[kind];
    if (!defaultId) {
      diagnostics.push(`no default Style is registered for element kind ${kind}`);
    } else if (!ids.has(defaultId)) {
      diagnostics.push(`default Style for ${kind} is missing: ${defaultId}`);
    }
  }

  return ids;
};

// ── Content ──────────────────────────────────────────────────────────────

const validateTextSource = (
  source: SlideTextSource,
  richText: RichText,
  where: string,
  diagnostics: string[]
): void => {
  if (source.kind === "prompt") {
    if (!source.output.outputId) {
      diagnostics.push(`${where} prompt source must reference an output`);
    }
    if (!Number.isSafeInteger(source.output.appliedRevision) || source.output.appliedRevision <= 0) {
      diagnostics.push(`${where} prompt source must carry a positive applied revision`);
    }
    return;
  }
  const result = richText.validate(source.content);
  if (!result.ok) {
    diagnostics.push(
      `${where} holds invalid Rich Content: ${result.diagnostics.map((item) => item.message).join(", ")}`
    );
  }
};

const validateTable = (
  table: SlideTable,
  richText: RichText,
  where: string,
  diagnostics: string[]
): void => {
  const rowIds = new Set<string>();
  for (const row of table.rows) {
    if (rowIds.has(row.id)) diagnostics.push(`${where} has a duplicate table row ${row.id}`);
    rowIds.add(row.id);
    if (row.minHeightPt !== undefined && !Number.isFinite(row.minHeightPt)) {
      diagnostics.push(`${where} row ${row.id} has a non-finite minimum height`);
    }
  }

  const columnIds = new Set<string>();
  for (const column of table.columns) {
    if (columnIds.has(column.id)) {
      diagnostics.push(`${where} has a duplicate table column ${column.id}`);
    }
    columnIds.add(column.id);
    if (column.width.kind === "fixed" && !(column.width.widthPt > 0)) {
      diagnostics.push(`${where} column ${column.id} must have a positive width`);
    }
  }

  if (table.rows.length === 0) diagnostics.push(`${where} must have at least one table row`);
  if (table.columns.length === 0) diagnostics.push(`${where} must have at least one table column`);

  const cellIds = new Set<string>();
  const occupied = new Set<string>();
  for (const cell of table.cells) {
    if (cellIds.has(cell.id)) diagnostics.push(`${where} has a duplicate table cell ${cell.id}`);
    cellIds.add(cell.id);
    if (!rowIds.has(cell.rowId)) {
      diagnostics.push(`${where} cell ${cell.id} references missing row ${cell.rowId}`);
    }
    if (!columnIds.has(cell.columnId)) {
      diagnostics.push(`${where} cell ${cell.id} references missing column ${cell.columnId}`);
    }
    const coordinate = `${cell.rowId}\u0000${cell.columnId}`;
    if (occupied.has(coordinate)) {
      diagnostics.push(`${where} has two cells at one coordinate`);
    }
    occupied.add(coordinate);
    validateTextSource(cell.body, richText, `${where} cell ${cell.id}`, diagnostics);
  }

  // A table is dense: every coordinate is materialised, unlike Spreadsheet.
  if (table.cells.length !== table.rows.length * table.columns.length) {
    diagnostics.push(`${where} must hold one cell per row and column`);
  }

  const mergeIds = new Set<string>();
  const covered = new Set<string>();
  for (const merge of table.merges) {
    if (mergeIds.has(merge.id)) diagnostics.push(`${where} has a duplicate merge ${merge.id}`);
    mergeIds.add(merge.id);
    if (!cellIds.has(merge.rootCellId)) {
      diagnostics.push(`${where} merge ${merge.id} references missing root cell`);
    }
    for (const cellId of merge.coveredCellIds) {
      if (!cellIds.has(cellId)) {
        diagnostics.push(`${where} merge ${merge.id} references missing covered cell ${cellId}`);
      }
      if (cellId === merge.rootCellId) {
        diagnostics.push(`${where} merge ${merge.id} covers its own root cell`);
      }
      if (covered.has(cellId)) {
        diagnostics.push(`${where} cell ${cellId} is covered by more than one merge`);
      }
      covered.add(cellId);
    }
  }
};

// ── Elements ─────────────────────────────────────────────────────────────

const validateElements = (
  snapshot: DeckSnapshot,
  container: ElementContainerRef,
  elements: Record<string, SlideElement>,
  styleIds: Set<string>,
  richText: RichText,
  diagnostics: string[]
): void => {
  const where = describeContainer(container);

  for (const [elementId, element] of Object.entries(elements)) {
    const at = `${where} element ${elementId}`;
    if (element.id !== elementId) {
      diagnostics.push(`${at} is keyed by a different ID than it carries`);
    }
    if (element.styleId !== undefined && !styleIds.has(element.styleId)) {
      diagnostics.push(`${at} references missing style ${element.styleId}`);
    }
    if (!isRotationValid(element.rotationDegrees)) {
      diagnostics.push(`${at} has a non-finite rotation`);
    }

    if (element.placement.kind === "free") {
      if (!isFrameValid(element.placement.frame)) {
        diagnostics.push(`${at} has an invalid frame`);
      }
    } else if (container.kind !== "slide") {
      diagnostics.push(`${at} may not bind a slot outside a Slide`);
    }

    if (element.parentGroupId !== undefined) {
      const parent = elements[element.parentGroupId];
      if (!parent) {
        diagnostics.push(`${at} references missing group ${element.parentGroupId}`);
      } else if (parent.kind !== "group") {
        diagnostics.push(`${at} names a non-group parent ${element.parentGroupId}`);
      }
    }

    if (element.kind === "text") {
      validateTextSource(element.body, richText, at, diagnostics);
    } else if (element.kind === "table") {
      validateTable(element.table, richText, at, diagnostics);
    } else if (element.kind === "chart") {
      const labelIds = new Set<string>();
      for (const label of element.chart.labels) {
        if (labelIds.has(label.id)) diagnostics.push(`${at} has a duplicate chart label ${label.id}`);
        labelIds.add(label.id);
        const result = richText.validate(label.content);
        if (!result.ok) diagnostics.push(`${at} label ${label.id} holds invalid Rich Content`);
      }
    } else if (element.kind === "image") {
      if (!element.image.source.fileId) diagnostics.push(`${at} must reference a file`);
      if (!element.image.decorative && !element.image.alt.trim()) {
        diagnostics.push(`${at} must carry alt text unless it is decorative`);
      }
    } else if (element.kind === "geometry") {
      validateAppearance(snapshot.theme, element.geometry.appearance, at, diagnostics);
    } else if (element.kind === "line") {
      if (!(element.line.widthPt > 0)) diagnostics.push(`${at} line width must be positive`);
      validateTokenReference(snapshot.theme, element.line.color, "color", `${at} line`, diagnostics);
    }
  }

  // No empty Group survives a ChangeSet.
  for (const element of Object.values(elements)) {
    if (element.kind !== "group") continue;
    if (siblingsOf(elements, element.id).length === 0) {
      diagnostics.push(`${where} group ${element.id} has no members`);
    }
  }

  // Group membership is acyclic. A cycle is precisely a set of elements that
  // cannot be reached from the container root, and checking reachability is the
  // only formulation a cycle cannot hide from: walking ancestors from a member
  // of a cycle terminates without ever revisiting that member.
  for (const id of unreachableElementIds(elements)) {
    diagnostics.push(`${where} element ${id} is not reachable from the container root`);
  }

  // zIndex is the sole sibling-order authority: unique and contiguous per parent.
  const parents = new Set<string | undefined>([undefined]);
  for (const element of Object.values(elements)) {
    if (element.kind === "group") parents.add(element.id);
  }
  for (const parent of parents) {
    const siblings = siblingsOf(elements, parent);
    const expected = siblings.map((_, index) => index).join(",");
    const actual = siblings.map((sibling) => sibling.zIndex).join(",");
    if (expected !== actual) {
      diagnostics.push(
        `${where} sibling z-order must be unique and contiguous under ${parent ?? "the container root"}`
      );
    }
  }

  if (container.kind !== "slide") return;

  const boundSlots = new Map<string, string>();
  const layout = snapshot.layouts[snapshot.slides[container.slideId]?.layoutId ?? ""];
  for (const element of Object.values(elements)) {
    if (element.placement.kind !== "slot") continue;
    const previous = boundSlots.get(element.placement.slotId);
    if (previous) {
      diagnostics.push(
        `${where} binds slot ${element.placement.slotId} from both ${previous} and ${element.id}`
      );
    }
    boundSlots.set(element.placement.slotId, element.id);

    // A dangling slot binding is legal and reported by a projection, but a
    // binding to a slot that exists must respect what that slot accepts.
    const slot = layout?.slots[element.placement.slotId];
    if (slot && !slotAccepts(slot, element)) {
      diagnostics.push(
        `${where} element ${element.id} of kind ${element.kind} may not bind slot ${slot.id}`
      );
    }
  }
};

// ── Snapshot ─────────────────────────────────────────────────────────────

export const validateSnapshot = (
  snapshot: DeckSnapshot,
  richText: RichText,
  limits: SlideLimits
): SlideValidationResult => {
  const diagnostics: string[] = [];

  if (snapshot.representationVersion !== 1) {
    diagnostics.push("unsupported representation version");
  }
  if (!snapshot.title.trim()) diagnostics.push("Deck must have a title");
  if (!isCanvasValid(snapshot.canvas)) {
    diagnostics.push("canvas dimensions must be positive");
  }

  validateTheme(snapshot.theme, diagnostics);
  const styleIds = validateStyles(snapshot.styles, snapshot.theme, diagnostics);

  for (const [masterId, master] of Object.entries(snapshot.masters)) {
    if (master.id !== masterId) {
      diagnostics.push(`Master ${masterId} is keyed by a different ID than it carries`);
    }
    if (!master.name.trim()) diagnostics.push(`Master ${masterId} must have a name`);
    validateBackground(snapshot.theme, master.background, `Master ${masterId}`, diagnostics);
  }
  if (Object.keys(snapshot.masters).length === 0) {
    diagnostics.push("a Deck must have at least one Master");
  }

  for (const [layoutId, layout] of Object.entries(snapshot.layouts)) {
    if (layout.id !== layoutId) {
      diagnostics.push(`Layout ${layoutId} is keyed by a different ID than it carries`);
    }
    if (!layout.name.trim()) diagnostics.push(`Layout ${layoutId} must have a name`);
    if (!snapshot.masters[layout.masterId]) {
      diagnostics.push(`Layout ${layoutId} references missing Master ${layout.masterId}`);
    }
    validateBackground(snapshot.theme, layout.background, `Layout ${layoutId}`, diagnostics);
    for (const [slotId, slot] of Object.entries(layout.slots)) {
      if (slot.id !== slotId) {
        diagnostics.push(`Layout ${layoutId} slot ${slotId} is keyed by a different ID`);
      }
      if (!slot.name.trim()) diagnostics.push(`Layout ${layoutId} slot ${slotId} must have a name`);
      if (!isFrameValid(slot.frame)) {
        diagnostics.push(`Layout ${layoutId} slot ${slotId} has an invalid frame`);
      }
      for (const kind of slot.accepts) {
        if (!SLIDE_ELEMENT_KINDS.includes(kind)) {
          diagnostics.push(`Layout ${layoutId} slot ${slotId} accepts unknown kind ${kind}`);
        }
      }
    }
  }
  if (Object.keys(snapshot.layouts).length === 0) {
    diagnostics.push("a Deck must have at least one Layout");
  }

  const seenSlides = new Set<string>();
  for (const slideId of snapshot.slideOrder) {
    if (seenSlides.has(slideId)) diagnostics.push(`duplicate Slide in order: ${slideId}`);
    seenSlides.add(slideId);
    if (!snapshot.slides[slideId]) {
      diagnostics.push(`slide order references missing Slide ${slideId}`);
    }
  }
  for (const [slideId, slide] of Object.entries(snapshot.slides)) {
    if (slide.id !== slideId) {
      diagnostics.push(`Slide ${slideId} is keyed by a different ID than it carries`);
    }
    if (!seenSlides.has(slideId)) diagnostics.push(`Slide ${slideId} is missing from slide order`);
    if (!snapshot.layouts[slide.layoutId]) {
      diagnostics.push(`Slide ${slideId} references missing Layout ${slide.layoutId}`);
    }
    validateBackground(snapshot.theme, slide.background, `Slide ${slideId}`, diagnostics);
    const notes = richText.validate(slide.notes);
    if (!notes.ok) {
      diagnostics.push(
        `Slide ${slideId} notes hold invalid Rich Content: ${notes.diagnostics.map((item) => item.message).join(", ")}`
      );
    }
  }
  if (snapshot.slideOrder.length === 0) {
    diagnostics.push("a Deck must have at least one Slide");
  }

  for (const container of allContainers(snapshot)) {
    validateElements(
      snapshot,
      container.ref,
      container.elements,
      styleIds,
      richText,
      diagnostics
    );
    if (Object.keys(container.elements).length > limits.maxElementsPerContainer) {
      diagnostics.push(`${describeContainer(container.ref)} exceeds the element limit`);
    }
    for (const element of Object.values(container.elements)) {
      if (ancestorsOf(container.elements, element.id).length > limits.maxGroupDepth) {
        diagnostics.push(`${describeContainer(container.ref)} exceeds the group nesting limit`);
        break;
      }
      if (element.kind !== "table") continue;
      if (element.table.rows.length > limits.maxTableRows) {
        diagnostics.push(`${describeContainer(container.ref)} table ${element.id} exceeds the row limit`);
      }
      if (element.table.columns.length > limits.maxTableColumns) {
        diagnostics.push(`${describeContainer(container.ref)} table ${element.id} exceeds the column limit`);
      }
    }
  }

  if (snapshot.slideOrder.length > limits.maxSlidesPerDeck) {
    diagnostics.push("Deck exceeds the Slide limit");
  }
  if (Object.keys(snapshot.masters).length > limits.maxMastersPerDeck) {
    diagnostics.push("Deck exceeds the Master limit");
  }
  if (Object.keys(snapshot.layouts).length > limits.maxLayoutsPerDeck) {
    diagnostics.push("Deck exceeds the Layout limit");
  }
  if (snapshot.styles.styles.length > limits.maxStylesPerDeck) {
    diagnostics.push("Deck exceeds the Style limit");
  }
  if (Object.keys(snapshot.theme.tokens).length > limits.maxTokensPerTheme) {
    diagnostics.push("theme exceeds the design token limit");
  }
  for (const layout of Object.values(snapshot.layouts)) {
    if (Object.keys(layout.slots).length > limits.maxSlotsPerLayout) {
      diagnostics.push(`Layout ${layout.id} exceeds the slot limit`);
    }
  }

  // One distinct dedicated Derived Output per live prompt source, and no output
  // bound at two sites.
  const outputSites = new Map<string, string>();
  const claim = (outputId: string, site: string): void => {
    const previous = outputSites.get(outputId);
    if (previous) {
      diagnostics.push(`Derived Output ${outputId} is bound at both ${previous} and ${site}`);
    }
    outputSites.set(outputId, site);
  };
  for (const container of allContainers(snapshot)) {
    const where = describeContainer(container.ref);
    for (const element of Object.values(container.elements)) {
      if (element.kind === "text" && element.body.kind === "prompt") {
        claim(element.body.output.outputId, `${where} element ${element.id}`);
        continue;
      }
      if (element.kind !== "table") continue;
      for (const cell of element.table.cells) {
        if (cell.body.kind !== "prompt") continue;
        claim(cell.body.output.outputId, `${where} cell ${cell.id}`);
      }
    }
  }

  return { ok: diagnostics.length === 0, diagnostics };
};
