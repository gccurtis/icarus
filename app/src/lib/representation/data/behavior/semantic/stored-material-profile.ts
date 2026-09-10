import {
  hasExactFields,
  isStoredChoice,
  isStoredFinite,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";

const textList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((entry) => isStoredText(entry, 10_000));

const column = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(
    held,
    ["name", "inferredType", "nullCount"],
    ["distinctCount", "minimum", "maximum"]
  ) && isStoredText(held.name, 10_000) &&
    isStoredChoice(held.inferredType, ["empty", "boolean", "number", "date", "text", "mixed"]) &&
    isStoredNatural(held.nullCount) &&
    (held.distinctCount === undefined || isStoredNatural(held.distinctCount)) &&
    (held.minimum === undefined || isStoredFinite(held.minimum)) &&
    (held.maximum === undefined || isStoredFinite(held.maximum));
};

const tabular = (value: unknown, kind: "table" | "csv"): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  const csv = kind === "csv";
  const required = csv
    ? [
        "kind", "delimiter", "encoding", "rows", "columns", "headers", "columnsProfile",
        "sample", "sampledRows", "malformedRows", "truncated", "warnings"
      ]
    : [
        "kind", "rows", "columns", "headerRows", "headers", "columnsProfile",
        "mergedRegions", "sample", "warnings"
      ];
  if (!hasExactFields(held, required, csv ? [] : ["sheet"]) || held.kind !== kind ||
    !isStoredNatural(held.rows) || !isStoredNatural(held.columns) ||
    !textList(held.headers) || !Array.isArray(held.columnsProfile) ||
    !held.columnsProfile.every(column) || !Array.isArray(held.sample) ||
    !held.sample.every(textList) || !textList(held.warnings)) return false;
  if (csv) {
    return isStoredText(held.delimiter, 20) && held.delimiter.length > 0 &&
      held.encoding === "utf-8" && isStoredNatural(held.sampledRows) &&
      isStoredNatural(held.malformedRows) && typeof held.truncated === "boolean";
  }
  return isStoredNatural(held.headerRows) && held.headerRows <= held.rows &&
    isStoredNatural(held.mergedRegions) &&
    (held.sheet === undefined || held.sheet === true);
};

const imageSource = (value: unknown): boolean => {
  const source = storedFields(value);
  if (source === undefined) return false;
  if (source.kind === "url") {
    return hasExactFields(source, ["kind", "url"]) && isStoredText(source.url, 10_000);
  }
  if (source.kind === "file") {
    return hasExactFields(source, ["kind", "fileId"]) &&
      isStoredRowId(source.fileId, "externalFiles");
  }
  return source.kind === "storage" && hasExactFields(source, ["kind", "storageId"]) &&
    isStoredRowId(source.storageId, "_storage");
};

const symbol = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, ["name", "kind", "fromLine", "toLine"]) &&
    isStoredText(held.name, 10_000) && held.name.length > 0 &&
    isStoredChoice(held.kind, ["class", "function", "type", "variable", "export", "unknown"]) &&
    isStoredNatural(held.fromLine) && isStoredNatural(held.toLine) && held.toLine >= held.fromLine;
};

/** Exact current material profile across all native-profile variants. */
export const isStoredMaterialProfile = (value: unknown): boolean => {
  const profile = storedFields(value);
  if (profile === undefined) return false;
  if (profile.kind === "table" || profile.kind === "csv") return tabular(profile, profile.kind);
  if (profile.kind === "chart") {
    return hasExactFields(
      profile,
      ["kind", "chartType", "axes", "series", "measures", "points", "sourceHandles", "warnings"],
      ["title"]
    ) && isStoredText(profile.chartType, 500) && profile.chartType.length > 0 &&
      (profile.title === undefined || isStoredText(profile.title, 10_000)) &&
      textList(profile.axes) && textList(profile.series) && textList(profile.measures) &&
      isStoredNatural(profile.points) && textList(profile.sourceHandles) && textList(profile.warnings);
  }
  if (profile.kind === "image") {
    return hasExactFields(
      profile,
      ["kind", "assetHash", "source", "placementCount", "warnings"],
      ["mediaType", "width", "height", "alt", "caption"]
    ) && (profile.mediaType === undefined || isStoredText(profile.mediaType, 1_000)) &&
      (profile.width === undefined || isStoredNatural(profile.width)) &&
      (profile.height === undefined || isStoredNatural(profile.height)) &&
      isStoredText(profile.assetHash, 1_000) && profile.assetHash.length > 0 &&
      (profile.alt === undefined || isStoredText(profile.alt, 10_000)) &&
      (profile.caption === undefined || isStoredText(profile.caption, 10_000)) &&
      imageSource(profile.source) && isStoredNatural(profile.placementCount) &&
      textList(profile.warnings);
  }
  return profile.kind === "code" && hasExactFields(profile, [
    "kind", "language", "lines", "imports", "exports", "symbols", "parser", "truncated", "warnings"
  ]) && isStoredText(profile.language, 500) && isStoredNatural(profile.lines) &&
    textList(profile.imports) && textList(profile.exports) && Array.isArray(profile.symbols) &&
    profile.symbols.every(symbol) &&
    (profile.parser === "bounded-regex" || profile.parser === "unavailable") &&
    typeof profile.truncated === "boolean" && textList(profile.warnings);
};
