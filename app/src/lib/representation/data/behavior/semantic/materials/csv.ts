import type { CsvMaterialProfile } from "$representation/data/types/semantic/material";
import { columnProfiles } from "$representation/data/behavior/semantic/materials/profile";

export type CsvLimits = {
  maxBytes: number;
  maxRows: number;
  maxColumns: number;
  maxCells: number;
  sampleRows: number;
};

export const DEFAULT_CSV_LIMITS: CsvLimits = {
  maxBytes: 5_000_000,
  maxRows: 20_000,
  maxColumns: 256,
  maxCells: 200_000,
  sampleRows: 16
};

export type ParsedCsv = {
  rows: string[][];
  delimiter: string;
  malformedRows: number;
  truncated: boolean;
  warnings: string[];
};

const delimiterFor = (text: string): string => {
  const candidates = [",", "\t", ";", "|"];
  const counts = new Map(candidates.map((candidate) => [candidate, 0]));
  let quoted = false;
  for (let index = 0; index < Math.min(text.length, 65_536); index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) break;
    if (!quoted && counts.has(character)) counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  return candidates
    .map((delimiter) => ({ delimiter, count: counts.get(delimiter) ?? 0 }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ",";
};

/** Bounded RFC-4180-style parser. It preserves quoted newlines and reports malformed rows. */
export const parseCsv = (
  source: string,
  limits: CsvLimits = DEFAULT_CSV_LIMITS
): ParsedCsv => {
  const encoded = new TextEncoder().encode(source);
  const byteLength = encoded.byteLength;
  const text = byteLength > limits.maxBytes
    ? new TextDecoder().decode(encoded.slice(0, limits.maxBytes))
    : source;
  const delimiter = delimiterFor(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let malformedRows = 0;
  let cells = 0;
  let truncated = byteLength > limits.maxBytes;

  const pushField = () => {
    if (row.length < limits.maxColumns) row.push(field);
    else truncated = true;
    field = "";
    cells += 1;
  };
  const pushRow = () => {
    pushField();
    if (rows.length < limits.maxRows && cells <= limits.maxCells) rows.push(row);
    else truncated = true;
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    if (rows.length >= limits.maxRows || cells >= limits.maxCells) {
      truncated = true;
      break;
    }
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += character;
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
      continue;
    }
    if (character === delimiter) {
      pushField();
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
      continue;
    }
    field += character;
  }
  if (quoted) malformedRows += 1;
  if (field.length > 0 || row.length > 0) pushRow();
  const width = rows[0]?.length ?? 0;
  malformedRows += rows.filter((held, index) =>
    held.length !== width && !(quoted && index === rows.length - 1)
  ).length;
  return {
    rows,
    delimiter,
    malformedRows,
    truncated,
    warnings: [
      ...(quoted ? ["The CSV ended inside a quoted field."] : []),
      ...(malformedRows > 0 ? [`${malformedRows} row(s) do not match the header width.`] : []),
      ...(truncated ? ["The CSV profile reached a configured safety limit."] : [])
    ]
  };
};

const stratifiedSample = (rows: readonly string[][], limit: number): string[][] => {
  if (rows.length <= limit) return rows.map((row) => [...row]);
  return Array.from({ length: limit }, (_, index) =>
    [...rows[Math.floor((index * (rows.length - 1)) / Math.max(1, limit - 1))]]
  );
};

export const profileCsv = (
  text: string,
  limits: CsvLimits = DEFAULT_CSV_LIMITS
): { parsed: ParsedCsv; profile: CsvMaterialProfile } => {
  const parsed = parseCsv(text, limits);
  const headers = [...(parsed.rows[0] ?? [])];
  const values = parsed.rows.slice(1);
  const columns = parsed.rows.reduce((count, row) => Math.max(count, row.length), 0);
  return {
    parsed,
    profile: {
      kind: "csv",
      delimiter: parsed.delimiter,
      encoding: "utf-8",
      rows: values.length,
      columns,
      headers,
      columnsProfile: columnProfiles(values, headers, columns),
      sample: stratifiedSample(values, limits.sampleRows),
      sampledRows: Math.min(values.length, limits.sampleRows),
      malformedRows: parsed.malformedRows,
      truncated: parsed.truncated,
      warnings: parsed.warnings
    }
  };
};
