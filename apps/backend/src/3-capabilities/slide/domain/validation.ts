import type { FormulaWireValue } from "#formula";
import type { RichContent, RichText, TextStyleProperties } from "#rich-text";
import type {
  ChartShapeData,
  DeckSnapshot,
  ImageShapeData,
  ShapePresentationOverride,
  Slide,
  SlideBackground,
  SlideLimits,
  SlideShape,
  SlideShapeKind,
  SlideStyleRegistry,
  SlideVisualStyleProperties,
  TableShapeData,
  TextBoxPresentation
} from "./model.js";

export const SLIDE_SHAPE_KINDS: SlideShapeKind[] = [
  "text",
  "prompt-content",
  "geometry",
  "line",
  "image",
  "table",
  "chart"
];

export interface SlideValidationResult {
  ok: boolean;
  diagnostics: string[];
}

const COLOR_PATTERN = /^#[0-9a-f]{8}$/;
const UNSAFE_RECORD_KEYS = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  "__proto__",
  "prototype"
]);

export const isSafeSlideIdentity = (id: string): boolean =>
  id.length > 0 && !UNSAFE_RECORD_KEYS.has(id);

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const positive = (value: unknown): value is number => finite(value) && value > 0;

const nonNegative = (value: unknown): value is number => finite(value) && value >= 0;

const positiveInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;

const validateColor = (value: string, label: string, diagnostics: string[]): void => {
  if (!COLOR_PATTERN.test(value)) diagnostics.push(`${label} must be canonical lowercase #rrggbbaa`);
};

const validateTextStyle = (
  style: TextStyleProperties,
  label: string,
  diagnostics: string[]
): void => {
  if (style.fontFamily !== undefined && !style.fontFamily.trim()) {
    diagnostics.push(`${label} font family must be non-empty`);
  }
  if (style.fontSize !== undefined && !positive(style.fontSize)) {
    diagnostics.push(`${label} font size must be positive and finite`);
  }
  if (style.fontWeight !== undefined && !positive(style.fontWeight)) {
    diagnostics.push(`${label} font weight must be positive and finite`);
  }
  if (style.letterSpacing !== undefined && !finite(style.letterSpacing)) {
    diagnostics.push(`${label} letter spacing must be finite`);
  }
  if (style.lineHeight !== undefined && !positive(style.lineHeight)) {
    diagnostics.push(`${label} line height must be positive and finite`);
  }
  for (const [name, value] of [["color", style.color], ["background color", style.backgroundColor]] as const) {
    if (value !== undefined && !value.trim()) diagnostics.push(`${label} ${name} must be non-empty`);
  }
  for (const [name, value] of [
    ["italic", style.italic],
    ["underline", style.underline],
    ["strike", style.strike],
    ["code", style.code]
  ] as const) {
    if (value !== undefined && typeof value !== "boolean") diagnostics.push(`${label} ${name} must be boolean`);
  }
};

const validateVisualStyle = (
  style: SlideVisualStyleProperties,
  label: string,
  diagnostics: string[]
): void => {
  if (style.opacity !== undefined && (!finite(style.opacity) || style.opacity < 0 || style.opacity > 1)) {
    diagnostics.push(`${label} opacity must be in [0, 1]`);
  }
  if (style.fill?.kind === "solid") validateColor(style.fill.color, `${label} fill color`, diagnostics);
  if (style.stroke?.kind === "stroke") {
    validateColor(style.stroke.color, `${label} stroke color`, diagnostics);
    if (!positive(style.stroke.widthPt)) diagnostics.push(`${label} stroke width must be positive`);
  }
  if (style.shadow?.kind === "drop") {
    validateColor(style.shadow.color, `${label} shadow color`, diagnostics);
    if (!finite(style.shadow.offsetXPt) || !finite(style.shadow.offsetYPt) ||
        !nonNegative(style.shadow.blurPt)) {
      diagnostics.push(`${label} shadow geometry must be finite with non-negative blur`);
    }
  }
};

const validatePresentation = (
  presentation: ShapePresentationOverride | undefined,
  label: string,
  diagnostics: string[]
): void => {
  if (!presentation) return;
  if (presentation.visual) validateVisualStyle(presentation.visual, label, diagnostics);
  if (presentation.text) validateTextStyle(presentation.text, label, diagnostics);
};

const validateStyles = (
  registry: SlideStyleRegistry,
  diagnostics: string[]
): Set<string> => {
  const ids = new Set<string>();
  for (const style of registry.styles) {
    if (!style.id) diagnostics.push("style ID must be non-empty");
    if (ids.has(style.id)) diagnostics.push(`duplicate style ID: ${style.id}`);
    ids.add(style.id);
    if (!style.name.trim()) diagnostics.push(`style ${style.id} must have a name`);
    validateVisualStyle(style.visual, `style ${style.id}`, diagnostics);
    validateTextStyle(style.text, `style ${style.id}`, diagnostics);
  }
  for (const style of registry.styles) {
    if (style.basedOnStyleId && !ids.has(style.basedOnStyleId)) {
      diagnostics.push(`style ${style.id} inherits missing style ${style.basedOnStyleId}`);
    }
    const seen = new Set<string>([style.id]);
    let current = style;
    while (current.basedOnStyleId) {
      if (seen.has(current.basedOnStyleId)) {
        diagnostics.push(`style inheritance cycle at ${current.basedOnStyleId}`);
        break;
      }
      seen.add(current.basedOnStyleId);
      const next = registry.styles.find((candidate) => candidate.id === current.basedOnStyleId);
      if (!next) break;
      current = next;
    }
  }
  for (const kind of SLIDE_SHAPE_KINDS) {
    const styleId = registry.defaultStyleIdByShapeKind[kind];
    if (!styleId) diagnostics.push(`default ${kind} Style is required`);
    else if (!ids.has(styleId)) diagnostics.push(`default ${kind} Style does not resolve: ${styleId}`);
  }
  return ids;
};

const validateRichContent = (
  content: RichContent,
  label: string,
  richText: RichText,
  limits: SlideLimits,
  claimId: (id: string, label: string) => void,
  diagnostics: string[]
): void => {
  if (content.atoms.length > limits.maxAtomsPerRichContent) {
    diagnostics.push(`${label} exceeds atom limit`);
  }
  const result = richText.validate(content);
  for (const item of result.diagnostics) diagnostics.push(`${label}: ${item.message}`);
  for (const atom of content.atoms) claimId(atom.id, "Rich Text atom");
  for (const mark of content.marks) claimId(mark.id, "Rich Text mark");
};

const validateTextBox = (
  textBox: TextBoxPresentation,
  label: string,
  diagnostics: string[]
): void => {
  for (const [name, value] of Object.entries(textBox.paddingPt)) {
    if (!nonNegative(value)) diagnostics.push(`${label} ${name} padding must be non-negative and finite`);
  }
};

const validateImageSource = (
  image: ImageShapeData,
  label: string,
  diagnostics: string[]
): void => {
  const { source } = image;
  if (!source.fileId || !source.version || !source.digest || !source.mimeType) {
    diagnostics.push(`${label} image source must contain file, version, digest, and MIME type`);
  }
  if (source.mimeType && !source.mimeType.startsWith("image/")) {
    diagnostics.push(`${label} image MIME type must start with image/`);
  }
  if (image.decorative && image.alt !== "") diagnostics.push(`${label} decorative image alt must be empty`);
  if (!image.decorative && !image.alt.trim()) diagnostics.push(`${label} non-decorative image requires alt text`);
  if (image.crop) {
    const { left, top, right, bottom } = image.crop;
    for (const [name, value] of Object.entries(image.crop)) {
      if (!finite(value) || value < 0 || value >= 1) diagnostics.push(`${label} crop ${name} must be in [0, 1)`);
    }
    if (left + right >= 1 || top + bottom >= 1) {
      diagnostics.push(`${label} crop must leave positive image area`);
    }
  }
};

const validateBackground = (
  background: SlideBackground,
  label: string,
  diagnostics: string[]
): void => {
  if (background.kind === "solid") validateColor(background.color, `${label} background`, diagnostics);
  if (background.kind === "image") {
    const source = background.source;
    if (!source.fileId || !source.version || !source.digest || !source.mimeType) {
      diagnostics.push(`${label} background image has an invalid snapshot reference`);
    }
    if (source.mimeType && !source.mimeType.startsWith("image/")) {
      diagnostics.push(`${label} background image MIME type must start with image/`);
    }
  }
};

const validateWireValue = (
  value: FormulaWireValue,
  label: string,
  diagnostics: string[],
  state: { nodes: number },
  maxNodes: number
): void => {
  state.nodes += 1;
  if (state.nodes > maxNodes) return;
  if (value.kind === "number") {
    if (!/^-?\d+$/.test(value.numerator) || !/^-?\d+$/.test(value.denominator) ||
        /^-?0+$/.test(value.denominator)) {
      diagnostics.push(`${label} contains an invalid rational number`);
    }
    return;
  }
  if (value.kind === "text") {
    if (typeof value.value !== "string") diagnostics.push(`${label} contains invalid text`);
    return;
  }
  if (value.kind === "logic") {
    if (typeof value.value !== "boolean") diagnostics.push(`${label} contains invalid logic`);
    return;
  }
  if (value.kind === "null") return;
  if (new Set(value.fields).size !== value.fields.length || value.fields.some((field) => !field)) {
    diagnostics.push(`${label} fields must be unique and non-empty`);
  }
  if (value.kind === "list" && value.fields.length !== 1) {
    diagnostics.push(`${label} list must have exactly one field`);
  }
  if (value.kind === "record" && value.rows.length > 1) {
    diagnostics.push(`${label} record must have at most one row`);
  }
  for (const row of value.rows) {
    if (row.length !== value.fields.length) diagnostics.push(`${label} rows must match field count`);
    for (const item of row) validateWireValue(item, label, diagnostics, state, maxNodes);
  }
};

const validateAcceptedValue = (
  data: TableShapeData | ChartShapeData,
  kind: "table" | "chart",
  label: string,
  limits: SlideLimits,
  diagnostics: string[]
): void => {
  const value = data.accepted.value;
  if (kind === "table" && value.kind !== "table") diagnostics.push(`${label} requires a table value`);
  if (kind === "chart" && value.kind !== "list" && value.kind !== "record" && value.kind !== "table") {
    diagnostics.push(`${label} requires a list, record, or table value`);
  }
  const state = { nodes: 0 };
  validateWireValue(value, label, diagnostics, state, limits.maxAcceptedValueNodes);
  if (state.nodes > limits.maxAcceptedValueNodes) {
    diagnostics.push(`${label} exceeds accepted-value node limit`);
  }
};

const validateAxis = (
  axis: { min?: number; max?: number } | undefined,
  label: string,
  diagnostics: string[]
): void => {
  if (!axis) return;
  if (axis.min !== undefined && !finite(axis.min)) diagnostics.push(`${label} minimum must be finite`);
  if (axis.max !== undefined && !finite(axis.max)) diagnostics.push(`${label} maximum must be finite`);
  if (axis.min !== undefined && axis.max !== undefined && axis.min > axis.max) {
    diagnostics.push(`${label} minimum cannot exceed maximum`);
  }
};

export const validateSnapshot = (
  snapshot: DeckSnapshot,
  richText: RichText,
  limits: SlideLimits
): SlideValidationResult => {
  const diagnostics: string[] = [];
  const allIds = new Set<string>();
  const promptOutputIds = new Set<string>();
  const claimId = (id: string, label: string): void => {
    if (!id) diagnostics.push(`${label} ID must be non-empty`);
    if (id && !isSafeSlideIdentity(id)) diagnostics.push(`${label} ID is not a safe record key: ${id}`);
    if (allIds.has(id)) diagnostics.push(`duplicate identity ${id}`);
    allIds.add(id);
  };

  if (snapshot.representationVersion !== 1) diagnostics.push("unsupported representation version");
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) {
    diagnostics.push("revision must be a non-negative integer");
  }
  if (!snapshot.title.trim()) diagnostics.push("title must be non-empty");
  if (!positive(snapshot.canvas.widthPt) || !positive(snapshot.canvas.heightPt)) {
    diagnostics.push("canvas dimensions must be positive and finite");
  }
  if (snapshot.canvas.widthPt > limits.maxFrameDimensionPt ||
      snapshot.canvas.heightPt > limits.maxFrameDimensionPt) {
    diagnostics.push(`canvas dimensions exceed ${limits.maxFrameDimensionPt}pt`);
  }
  if (snapshot.styles.styles.length > limits.maxStylesPerDeck) {
    diagnostics.push(`style count exceeds ${limits.maxStylesPerDeck}`);
  }
  const styleIds = validateStyles(snapshot.styles, diagnostics);
  for (const styleId of styleIds) claimId(styleId, "style");

  if (snapshot.slideOrder.length === 0) diagnostics.push("Deck must contain at least one Slide");
  if (snapshot.slideOrder.length > limits.maxSlidesPerDeck) {
    diagnostics.push(`Slide count exceeds ${limits.maxSlidesPerDeck}`);
  }
  if (new Set(snapshot.slideOrder).size !== snapshot.slideOrder.length) {
    diagnostics.push("slideOrder contains duplicate Slide IDs");
  }
  for (const slideId of snapshot.slideOrder) {
    if (!Object.hasOwn(snapshot.slides, slideId)) diagnostics.push(`slideOrder references missing Slide ${slideId}`);
  }
  for (const key of Object.keys(snapshot.slides)) {
    if (!snapshot.slideOrder.includes(key)) diagnostics.push(`Slide ${key} is absent from slideOrder`);
  }

  const validateShape = (shape: SlideShape, slide: Slide): void => {
    if (!styleIds.has(shape.styleId)) diagnostics.push(`Shape ${shape.id} has missing Style ${shape.styleId}`);
    for (const [name, value] of Object.entries(shape.frame)) {
      if (!finite(value)) diagnostics.push(`Shape ${shape.id} frame ${name} must be finite`);
    }
    if (!positive(shape.frame.widthPt) || !positive(shape.frame.heightPt)) {
      diagnostics.push(`Shape ${shape.id} frame dimensions must be positive`);
    }
    if (shape.frame.widthPt > limits.maxFrameDimensionPt || shape.frame.heightPt > limits.maxFrameDimensionPt) {
      diagnostics.push(`Shape ${shape.id} frame exceeds dimension limit`);
    }
    if (!finite(shape.transform.rotationDegrees) || shape.transform.rotationDegrees < 0 ||
        shape.transform.rotationDegrees >= 360) {
      diagnostics.push(`Shape ${shape.id} rotation must be in [0, 360)`);
    }
    if (typeof shape.transform.flipHorizontal !== "boolean" || typeof shape.transform.flipVertical !== "boolean") {
      diagnostics.push(`Shape ${shape.id} flip state must be boolean`);
    }
    validatePresentation(shape.presentation, `Shape ${shape.id}`, diagnostics);

    if (shape.shapeKind === "text") {
      validateTextBox(shape.textBox, `Text Shape ${shape.id}`, diagnostics);
      validateRichContent(shape.content, `Text Shape ${shape.id}`, richText, limits, claimId, diagnostics);
    } else if (shape.shapeKind === "prompt-content") {
      validateTextBox(shape.textBox, `Prompt Content ${shape.id}`, diagnostics);
      if (!shape.output.outputId || !positiveInteger(shape.output.appliedRevision)) {
        diagnostics.push(`Prompt Content ${shape.id} has an invalid Derived Output reference`);
      }
      if (promptOutputIds.has(shape.output.outputId)) {
        diagnostics.push(`Derived Output ${shape.output.outputId} is shared by live Prompt Content Shapes`);
      }
      promptOutputIds.add(shape.output.outputId);
    } else if (shape.shapeKind === "geometry") {
      if (shape.geometry.kind === "rounded-rectangle" &&
          (!nonNegative(shape.geometry.cornerRadiusPt) ||
           shape.geometry.cornerRadiusPt > Math.min(shape.frame.widthPt, shape.frame.heightPt) / 2)) {
        diagnostics.push(`Geometry ${shape.id} corner radius is outside its frame`);
      }
    } else if (shape.shapeKind === "line") {
      for (const [pointName, point] of [["start", shape.line.start], ["end", shape.line.end]] as const) {
        if (!finite(point.x) || !finite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
          diagnostics.push(`Line ${shape.id} ${pointName} must be in the local unit square`);
        }
      }
      if (shape.line.start.x === shape.line.end.x && shape.line.start.y === shape.line.end.y) {
        diagnostics.push(`Line ${shape.id} endpoints must differ`);
      }
    } else if (shape.shapeKind === "image") {
      validateImageSource(shape.image, `Image ${shape.id}`, diagnostics);
    } else if (shape.shapeKind === "table") {
      validateAcceptedValue(shape.table, "table", `Table ${shape.id}`, limits, diagnostics);
      const value = shape.table.accepted.value;
      if (shape.table.presentation.columnWidthsPt) {
        if (value.kind === "table" && shape.table.presentation.columnWidthsPt.length !== value.fields.length) {
          diagnostics.push(`Table ${shape.id} column widths must match field count`);
        }
        if (shape.table.presentation.columnWidthsPt.some((width) => !positive(width))) {
          diagnostics.push(`Table ${shape.id} column widths must be positive and finite`);
        }
      }
    } else if (shape.shapeKind === "chart") {
      validateAcceptedValue(shape.chart, "chart", `Chart ${shape.id}`, limits, diagnostics);
      validateAxis(shape.chart.specification.xAxis, `Chart ${shape.id} X axis`, diagnostics);
      validateAxis(shape.chart.specification.yAxis, `Chart ${shape.id} Y axis`, diagnostics);
      for (const color of shape.chart.specification.colors ?? []) {
        validateColor(color, `Chart ${shape.id} color`, diagnostics);
      }
    }

    void slide;
  };

  const validateSlide = (slide: Slide, key: string): void => {
    claimId(slide.id, "slide");
    if (slide.id !== key) diagnostics.push(`Slide record key ${key} does not match ID ${slide.id}`);
    validateBackground(slide.background, `Slide ${slide.id}`, diagnostics);
    validateRichContent(slide.notes, `Slide ${slide.id} notes`, richText, limits, claimId, diagnostics);
    const elementValues = Object.values(slide.elements);
    if (elementValues.length > limits.maxElementsPerSlide) {
      diagnostics.push(`Slide ${slide.id} exceeds element limit`);
    }
    for (const [elementKey, element] of Object.entries(slide.elements)) {
      claimId(element.id, element.elementKind);
      if (element.id !== elementKey) diagnostics.push(`Element record key ${elementKey} does not match ID ${element.id}`);
      if (typeof element.locked !== "boolean" || typeof element.hidden !== "boolean") {
        diagnostics.push(`Element ${element.id} lock/hidden state must be boolean`);
      }
      if (element.elementKind === "group") {
        if (element.childElementIds.length === 0) diagnostics.push(`Group ${element.id} must not be empty`);
        if (new Set(element.childElementIds).size !== element.childElementIds.length) {
          diagnostics.push(`Group ${element.id} contains duplicate child IDs`);
        }
      } else {
        validateShape(element, slide);
      }
    }
    if (new Set(slide.rootElementIds).size !== slide.rootElementIds.length) {
      diagnostics.push(`Slide ${slide.id} root contains duplicate element IDs`);
    }

    const membership = new Map<string, number>();
    const countMembership = (id: string): void => {
      membership.set(id, (membership.get(id) ?? 0) + 1);
    };
    for (const id of slide.rootElementIds) countMembership(id);
    for (const element of elementValues) {
      if (element.elementKind === "group") {
        for (const childId of element.childElementIds) countMembership(childId);
      }
    }
    for (const [id, count] of membership) {
      if (!Object.hasOwn(slide.elements, id)) diagnostics.push(`Slide ${slide.id} ordering references missing element ${id}`);
      if (count !== 1) diagnostics.push(`Element ${id} has ${count} memberships`);
    }
    for (const id of Object.keys(slide.elements)) {
      if ((membership.get(id) ?? 0) !== 1) diagnostics.push(`Element ${id} must have exactly one membership`);
    }

    const reached = new Set<string>();
    const visit = (id: string, depth: number, ancestors: Set<string>): void => {
      if (depth > limits.maxGroupNestingDepth) {
        diagnostics.push(`Group nesting exceeds ${limits.maxGroupNestingDepth} at ${id}`);
        return;
      }
      const element = Object.hasOwn(slide.elements, id) ? slide.elements[id] : undefined;
      if (!element) return;
      if (ancestors.has(id)) {
        diagnostics.push(`Group cycle at ${id}`);
        return;
      }
      reached.add(id);
      if (element.elementKind !== "group") return;
      const next = new Set(ancestors).add(id);
      for (const childId of element.childElementIds) visit(childId, depth + 1, next);
    };
    for (const rootId of slide.rootElementIds) visit(rootId, 1, new Set());
    for (const id of Object.keys(slide.elements)) {
      if (reached.has(id)) continue;
      diagnostics.push(`Element ${id} is not reachable from Slide ${slide.id} root`);
      // A disconnected component can be a closed Group cycle while still
      // satisfying the exactly-one-membership count. Traverse it explicitly
      // so cycle and depth diagnostics are never root-dependent.
      visit(id, 1, new Set());
    }
  };

  for (const slideId of snapshot.slideOrder) {
    const slide = Object.hasOwn(snapshot.slides, slideId) ? snapshot.slides[slideId] : undefined;
    if (slide) validateSlide(slide, slideId);
  }

  return { ok: diagnostics.length === 0, diagnostics };
};
