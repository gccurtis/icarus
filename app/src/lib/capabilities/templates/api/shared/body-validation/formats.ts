import {
  type Fields,
  MAX_STYLES,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  validCanonicalText,
  validIdentifier,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";

export const validFormat = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "horizontalAlignment",
      "verticalAlignment",
      "fontFamily",
      "fontSize",
      "color",
      "lineHeight",
      "spaceBefore",
      "spaceAfter",
      "indent",
      "background",
      "border",
      "padding",
      "valueFormat"
    ])
  ) {
    return false;
  }
  if (
    value.horizontalAlignment !== undefined &&
    !["start", "center", "end", "justify"].includes(value.horizontalAlignment as string)
  ) {
    return false;
  }
  if (
    value.verticalAlignment !== undefined &&
    !["top", "middle", "bottom"].includes(value.verticalAlignment as string)
  ) {
    return false;
  }
  for (const key of ["fontFamily", "color"] as const) {
    if (value[key] !== undefined && !validText(value[key], 1_000)) return false;
  }
  if (
    value.fontSize !== undefined &&
    (!isFiniteNumber(value.fontSize) || value.fontSize <= 0 || value.fontSize > 1_000)
  ) {
    return false;
  }
  if (
    value.lineHeight !== undefined &&
    (!isFiniteNumber(value.lineHeight) || value.lineHeight <= 0 || value.lineHeight > 100)
  ) {
    return false;
  }
  for (const key of ["spaceBefore", "spaceAfter", "indent"] as const) {
    if (
      value[key] !== undefined &&
      (!isFiniteNumber(value[key]) || (value[key] as number) < -10_000 || (value[key] as number) > 10_000)
    ) {
      return false;
    }
  }
  if (value.background !== undefined && !validText(value.background, 1_000)) return false;
  if (value.valueFormat !== undefined && !validText(value.valueFormat, 1_000, true)) return false;
  if (value.border !== undefined) {
    if (
      !isRecord(value.border) ||
      !hasOnlyKeys(value.border, ["color", "width", "style"]) ||
      !validText(value.border.color, 1_000) ||
      !isFiniteNumber(value.border.width) ||
      value.border.width < 0 ||
      value.border.width > 1_000 ||
      !["solid", "dashed", "dotted"].includes(value.border.style as string)
    ) {
      return false;
    }
  }
  if (value.padding !== undefined) {
    if (!isRecord(value.padding) || !hasOnlyKeys(value.padding, ["x", "y"])) return false;
    if (
      (value.padding.x !== undefined &&
        (!isFiniteNumber(value.padding.x) || value.padding.x < 0 || value.padding.x > 10_000)) ||
      (value.padding.y !== undefined &&
        (!isFiniteNumber(value.padding.y) || value.padding.y < 0 || value.padding.y > 10_000))
    ) {
      return false;
    }
  }
  return true;
};

const validCellBorder = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["top", "right", "bottom", "left"]) &&
  Object.values(value).every(
    (line) =>
      line === undefined ||
      (isRecord(line) &&
        hasOnlyKeys(line, ["color", "width", "style"]) &&
        Object.keys(line).length === 3 &&
        validText(line.color, 1_000) &&
        isFiniteNumber(line.width) &&
        line.width >= 0 &&
        line.width <= 1_000 &&
        ["solid", "dashed", "dotted"].includes(line.style as string))
  );

export const validCellFormat = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "horizontalAlignment",
      "verticalAlignment",
      "fontFamily",
      "fontSize",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "color",
      "background",
      "border",
      "valueFormat"
    ])
  ) {
    return false;
  }
  for (const key of ["fontFamily", "color", "background"] as const) {
    if (value[key] !== undefined && !validText(value[key], 1_000)) return false;
  }
  for (const key of ["bold", "italic", "underline", "strikethrough"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") return false;
  }
  return (
    (value.horizontalAlignment === undefined ||
      ["start", "center", "end", "justify"].includes(value.horizontalAlignment as string)) &&
    (value.verticalAlignment === undefined ||
      ["top", "middle", "bottom"].includes(value.verticalAlignment as string)) &&
    (value.fontSize === undefined ||
      (isFiniteNumber(value.fontSize) && value.fontSize > 0 && value.fontSize <= 1_000)) &&
    (value.border === undefined || validCellBorder(value.border)) &&
    (value.valueFormat === undefined || validText(value.valueFormat, 1_000, true))
  );
};

const validTextStyle = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "name",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "color",
      "background",
      "lineHeight",
      "spaceBefore",
      "spaceAfter",
      "horizontalAlignment",
      "verticalAlignment",
      "indent"
    ]) ||
    !validCanonicalText(value.name, 160)
  ) {
    return false;
  }
  for (const key of ["fontFamily", "color", "background"] as const) {
    if (value[key] !== undefined && !validText(value[key], 1_000)) return false;
  }
  for (const key of ["bold", "italic", "underline", "strikethrough"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") return false;
  }
  if (
    value.fontSize !== undefined &&
    (!isFiniteNumber(value.fontSize) || value.fontSize <= 0 || value.fontSize > 1_000)
  ) {
    return false;
  }
  if (
    value.fontWeight !== undefined &&
    (!isFiniteNumber(value.fontWeight) || value.fontWeight < 1 || value.fontWeight > 1_000)
  ) {
    return false;
  }
  if (
    value.lineHeight !== undefined &&
    (!isFiniteNumber(value.lineHeight) || value.lineHeight <= 0 || value.lineHeight > 100)
  ) {
    return false;
  }
  for (const key of ["spaceBefore", "spaceAfter", "indent"] as const) {
    if (
      value[key] !== undefined &&
      (!isFiniteNumber(value[key]) || (value[key] as number) < -10_000 || (value[key] as number) > 10_000)
    ) {
      return false;
    }
  }
  return (
    (value.horizontalAlignment === undefined ||
      ["start", "center", "end", "justify"].includes(value.horizontalAlignment as string)) &&
    (value.verticalAlignment === undefined ||
      ["top", "middle", "bottom"].includes(value.verticalAlignment as string))
  );
};

const validCellStyle = (value: unknown): boolean => {
  if (!isRecord(value) || !validCanonicalText(value.name, 160)) return false;
  const { name: _name, fontWeight, ...format } = value;
  void _name;
  return (
    (fontWeight === undefined ||
      (isFiniteNumber(fontWeight) && fontWeight >= 1 && fontWeight <= 1_000)) &&
    validCellFormat(format)
  );
};

export const validStyles = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["defaultKey", "styles"]) ||
    !validIdentifier(value.defaultKey) ||
    !isRecord(value.styles) ||
    Object.keys(value.styles).length > MAX_STYLES
  ) {
    return false;
  }
  return Object.entries(value.styles).every(
    ([key, style]) => validIdentifier(key) && validTextStyle(style)
  );
};

export const validCellStyles = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["defaultKey", "styles"]) ||
    !validIdentifier(value.defaultKey) ||
    !isRecord(value.styles) ||
    Object.keys(value.styles).length > MAX_STYLES
  ) {
    return false;
  }
  return Object.entries(value.styles).every(
    ([key, style]) => validIdentifier(key) && validCellStyle(style)
  );
};
