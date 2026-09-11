import {
  hasExactFields,
  isStoredFinite,
  isStoredIdentifier,
  isStoredText,
  storedFields,
  type StoredFields
} from "$representation/data/behavior/core/stored";

const horizontal = (value: unknown): boolean =>
  value === "start" || value === "center" || value === "end" || value === "justify";

const vertical = (value: unknown): boolean =>
  value === "top" || value === "middle" || value === "bottom";

const optionalText = (row: StoredFields, fields: readonly string[]): boolean =>
  fields.every((field) => row[field] === undefined || isStoredText(row[field], 10_000));

const optionalFlags = (row: StoredFields, fields: readonly string[]): boolean =>
  fields.every((field) => row[field] === undefined || typeof row[field] === "boolean");

const bounded = (value: unknown, minimum: number, maximum: number): value is number =>
  isStoredFinite(value) && value >= minimum && value <= maximum;

const currentBorderLine = (value: unknown): boolean => {
  const line = storedFields(value);
  return line !== undefined &&
    hasExactFields(line, ["color", "width", "style"]) &&
    isStoredText(line.color, 10_000) &&
    bounded(line.width, 0, 1_000) &&
    (line.style === "solid" || line.style === "dashed" || line.style === "dotted");
};

const currentCellBorder = (value: unknown): boolean => {
  const border = storedFields(value);
  return border !== undefined &&
    hasExactFields(border, [], ["top", "right", "bottom", "left"]) &&
    Object.values(border).every(currentBorderLine);
};

export const isStoredCellFormat = (value: unknown): boolean => {
  const format = storedFields(value);
  return format !== undefined &&
    hasExactFields(
      format,
      [],
      [
        "horizontalAlignment", "verticalAlignment", "fontFamily", "fontSize", "bold",
        "italic", "underline", "strikethrough", "color", "background", "border",
        "valueFormat"
      ]
    ) &&
    (format.horizontalAlignment === undefined || horizontal(format.horizontalAlignment)) &&
    (format.verticalAlignment === undefined || vertical(format.verticalAlignment)) &&
    optionalText(format, ["fontFamily", "color", "background", "valueFormat"]) &&
    (format.fontSize === undefined || (
      bounded(format.fontSize, Number.MIN_VALUE, 1_000)
    )) &&
    optionalFlags(format, ["bold", "italic", "underline", "strikethrough"]) &&
    (format.border === undefined || currentCellBorder(format.border));
};

type StyleKind = "document" | "presentation" | "spreadsheet";

const currentTextStyle = (value: unknown, kind: StyleKind): boolean => {
  const style = storedFields(value);
  if (style === undefined) return false;
  const optional = [
    "fontFamily", "fontSize", "fontWeight", "bold", "italic", "underline", "strikethrough",
    "color", "background", "horizontalAlignment", "indent"
  ];
  if (kind !== "spreadsheet") optional.push("lineHeight", "spaceBefore", "spaceAfter");
  if (kind !== "document") optional.push("verticalAlignment");
  if (kind === "spreadsheet") optional.push("border", "valueFormat");
  return hasExactFields(style, ["name"], optional) &&
    isStoredText(style.name, 10_000) &&
    style.name.length > 0 &&
    optionalText(style, ["fontFamily", "color", "background", "valueFormat"]) &&
    (style.fontSize === undefined || bounded(style.fontSize, Number.MIN_VALUE, 1_000)) &&
    (style.fontWeight === undefined || bounded(style.fontWeight, 1, 1_000)) &&
    (style.lineHeight === undefined || bounded(style.lineHeight, Number.MIN_VALUE, 100)) &&
    [style.spaceBefore, style.spaceAfter, style.indent].every(
      (entry) => entry === undefined || bounded(entry, -10_000, 10_000)
    ) &&
    optionalFlags(style, ["bold", "italic", "underline", "strikethrough"]) &&
    (style.horizontalAlignment === undefined || horizontal(style.horizontalAlignment)) &&
    (style.verticalAlignment === undefined || vertical(style.verticalAlignment)) &&
    (style.border === undefined || currentCellBorder(style.border));
};

const currentStyleSet = (value: unknown, kind: StyleKind): boolean => {
  const set = storedFields(value);
  const styles = storedFields(set?.styles);
  return set !== undefined &&
    hasExactFields(set, ["styles", "defaultKey"]) &&
    styles !== undefined &&
    Object.entries(styles).every(
      ([key, style]) => isStoredIdentifier(key) && currentTextStyle(style, kind)
    ) &&
    isStoredIdentifier(set.defaultKey) &&
    Object.hasOwn(styles, set.defaultKey);
};

export const isStoredDocumentStyles = (value: unknown): boolean =>
  currentStyleSet(value, "document");

export const isStoredSlideStyles = (value: unknown): boolean =>
  currentStyleSet(value, "presentation");

export const isStoredSpreadsheetStyles = (value: unknown): boolean =>
  currentStyleSet(value, "spreadsheet");

const PAPER_DIMENSIONS: Readonly<Record<string, readonly [number, number]>> = {
  letter: [8.5, 11],
  legal: [8.5, 14],
  tabloid: [11, 17],
  a3: [11.69, 16.54],
  a4: [8.27, 11.69],
  a5: [5.83, 8.27]
};

export const isStoredPageSetup = (value: unknown): boolean => {
  const setup = storedFields(value);
  const margins = storedFields(setup?.margins);
  const customPaper = storedFields(setup?.paper);
  const dimensions: readonly [number, number] | undefined =
    typeof setup?.paper === "string" && Object.hasOwn(PAPER_DIMENSIONS, setup.paper)
      ? PAPER_DIMENSIONS[setup.paper]
      : customPaper !== undefined &&
          hasExactFields(customPaper, ["width", "height"]) &&
          bounded(customPaper.width, Number.MIN_VALUE, 1_000) &&
          bounded(customPaper.height, Number.MIN_VALUE, 1_000)
        ? [customPaper.width, customPaper.height]
        : undefined;
  if (!(setup !== undefined &&
    hasExactFields(setup, ["paper", "orientation", "margins"]) &&
    dimensions !== undefined &&
    (setup.orientation === "portrait" || setup.orientation === "landscape") &&
    margins !== undefined &&
    hasExactFields(margins, ["top", "right", "bottom", "left"]) &&
    [margins.top, margins.right, margins.bottom, margins.left].every(
      (margin) => bounded(margin, 0, 100)
    ))) return false;
  const [width, height] = setup.orientation === "portrait"
    ? dimensions
    : [dimensions[1], dimensions[0]] as const;
  return (margins.left as number) + (margins.right as number) < width &&
    (margins.top as number) + (margins.bottom as number) < height;
};
