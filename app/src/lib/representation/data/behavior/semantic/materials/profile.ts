import type {
  ContentBlock,
  ImageBlock,
  TableBlock
} from "$representation/data/types/content/content-block";
import type {
  ChartMaterialProfile,
  ImageMaterialProfile,
  MaterialColumnProfile,
  TableMaterialProfile
} from "$representation/data/types/semantic/material";

const LIMITS = {
  sampleRows: 12,
  distinctValues: 1_000,
  chartWalkNodes: 2_000,
  chartLabels: 100
} as const;

export const blockText = (block: ContentBlock): string => {
  if (block.type === "prompt") return "";
  if (block.type === "text" || block.type === "formula") return block.display.trim();
  if (block.type === "image") {
    return [block.alt, block.caption === undefined ? "" : blockText(block.caption)]
      .filter(Boolean)
      .join("\n");
  }
  return block.rows
    .flatMap((row) => row.cells.map((cell) => cell.blocks.map(blockText).filter(Boolean).join("\n")))
    .filter(Boolean)
    .join("\t");
};

export const tableMatrix = (table: TableBlock): string[][] =>
  table.rows.map((row) =>
    row.cells.map((cell) => cell.blocks.map(blockText).filter(Boolean).join("\n"))
  );

const sampled = (rows: readonly string[][], limit = LIMITS.sampleRows): string[][] => {
  if (rows.length <= limit) return rows.map((row) => [...row]);
  const indexes = new Set<number>([0, 1, rows.length - 2, rows.length - 1]);
  const remaining = Math.max(0, limit - indexes.size);
  for (let index = 1; index <= remaining; index += 1) {
    indexes.add(Math.floor((index * (rows.length - 1)) / (remaining + 1)));
  }
  return [...indexes].sort((left, right) => left - right).map((index) => [...rows[index]]);
};

const cellType = (value: string): MaterialColumnProfile["inferredType"] => {
  const text = value.trim();
  if (!text) return "empty";
  if (/^(true|false|yes|no)$/i.test(text)) return "boolean";
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text.replaceAll(",", ""))) {
    return "number";
  }
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/.test(text)) return "date";
  return "text";
};

const inferredType = (values: readonly string[]): MaterialColumnProfile["inferredType"] => {
  const types = new Set(values.map(cellType).filter((kind) => kind !== "empty"));
  if (types.size === 0) return "empty";
  return types.size === 1 ? [...types][0] : "mixed";
};

export const columnProfiles = (
  rows: readonly string[][],
  headers: readonly string[],
  columns: number
): MaterialColumnProfile[] =>
  Array.from({ length: columns }, (_, column) => {
    const values = rows.map((row) => row[column] ?? "");
    const numbers = values
      .filter((value) => cellType(value) === "number")
      .map((value) => Number(value.replaceAll(",", "")))
      .filter(Number.isFinite);
    const distinct = new Set(values.filter((value) => value.trim()).slice(0, LIMITS.distinctValues));
    return {
      name: headers[column]?.trim() || `Column ${column + 1}`,
      inferredType: inferredType(values),
      nullCount: values.filter((value) => !value.trim()).length,
      ...(values.length <= LIMITS.distinctValues ? { distinctCount: distinct.size } : {}),
      ...(numbers.length === 0 ? {} : { minimum: Math.min(...numbers), maximum: Math.max(...numbers) })
    };
  });

export const profileTable = (table: TableBlock): TableMaterialProfile => {
  const matrix = tableMatrix(table);
  const columns = matrix.reduce((count, row) => Math.max(count, row.length), 0);
  const headerRows = Math.min(Math.max(0, table.headerRows), matrix.length);
  const headers = Array.from({ length: columns }, (_, column) =>
    matrix.slice(0, headerRows).map((row) => row[column] ?? "").filter(Boolean).join(" / ")
  );
  const values = matrix.slice(headerRows);
  return {
    kind: "table",
    rows: matrix.length,
    columns,
    headerRows,
    headers,
    columnsProfile: columnProfiles(values, headers, columns),
    mergedRegions: table.rows.reduce(
      (count, row) => count + row.cells.filter((cell) => (cell.rowSpan ?? 1) > 1 || (cell.columnSpan ?? 1) > 1).length,
      0
    ),
    sample: sampled(matrix),
    warnings: matrix.length === 0 ? ["The table contains no rows."] : []
  };
};

const strings = (value: unknown, output: Set<string>, budget: { left: number }): void => {
  if (budget.left <= 0 || output.size >= LIMITS.chartLabels) return;
  budget.left -= 1;
  if (typeof value === "string" && value.trim()) {
    output.add(value.trim().slice(0, 200));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) strings(entry, output, budget);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) strings(entry, output, budget);
  }
};

const at = (spec: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) if (spec[key] !== undefined) return spec[key];
  return undefined;
};

const namesIn = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (entry === null || typeof entry !== "object") return [];
    const object = entry as Record<string, unknown>;
    const name = object.name ?? object.label ?? object.key ?? object.id;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  });
};

export const profileChart = (spec: Record<string, unknown>): ChartMaterialProfile => {
  const labels = new Set<string>();
  strings(spec, labels, { left: LIMITS.chartWalkNodes });
  const series = namesIn(at(spec, ["series", "datasets", "data"]));
  const axes = namesIn(at(spec, ["axes", "scales"]));
  const title = at(spec, ["title", "name"]);
  const type = at(spec, ["type", "chartType", "mark"]);
  const serialized = JSON.stringify(spec);
  const points = (serialized.match(/(?:"value"|"y"|"x")\s*:/g) ?? []).length;
  return {
    kind: "chart",
    chartType: typeof type === "string" && type.trim() ? type.trim() : "unspecified",
    ...(typeof title === "string" && title.trim() ? { title: title.trim() } : {}),
    axes,
    series,
    measures: [...labels].filter((label) => /revenue|cost|count|rate|amount|total|value|percent/i.test(label)).slice(0, 20),
    points,
    sourceHandles: [],
    warnings: type === undefined ? ["The chart specification does not declare a normalized type."] : []
  };
};

export const profileImage = (
  block: ImageBlock,
  assetHash: string,
  placementCount = 1,
  mediaType?: string
): ImageMaterialProfile => ({
  kind: "image",
  ...(mediaType === undefined ? {} : { mediaType }),
  assetHash,
  ...(block.alt.trim() ? { alt: block.alt.trim() } : {}),
  ...(block.caption === undefined || !blockText(block.caption)
    ? {}
    : { caption: blockText(block.caption) }),
  source: block.source ?? { kind: "url", url: "about:blank" },
  placementCount,
  warnings: block.source === undefined ? ["The image has no native source yet."] : []
});

export const materialProfileText = (
  name: string,
  profile: TableMaterialProfile | ChartMaterialProfile | ImageMaterialProfile
): string => {
  if (profile.kind === "table") {
    return [
      `${name}. Table with ${profile.rows} rows and ${profile.columns} columns.`,
      profile.headers.filter(Boolean).length ? `Headers: ${profile.headers.filter(Boolean).join(", ")}.` : "",
      profile.columnsProfile.map((column) => `${column.name}: ${column.inferredType}`).join("; ")
    ].filter(Boolean).join(" ");
  }
  if (profile.kind === "chart") {
    return [
      `${name}. ${profile.chartType} chart.`,
      profile.series.length ? `Series: ${profile.series.join(", ")}.` : "",
      profile.measures.length ? `Measures: ${profile.measures.join(", ")}.` : ""
    ].filter(Boolean).join(" ");
  }
  return [
    `${name}. Image${profile.mediaType ? ` (${profile.mediaType})` : ""}.`,
    profile.alt ? `Alt text: ${profile.alt}.` : "",
    profile.caption ? `Caption: ${profile.caption}.` : ""
  ].filter(Boolean).join(" ");
};
