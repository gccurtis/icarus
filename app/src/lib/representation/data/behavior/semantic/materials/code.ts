import type { CodeMaterialProfile, CodeSymbolProfile } from "$representation/data/types/semantic/material";
import { externalCodeLanguage } from "$representation/data/behavior/external/file";

export const codeLanguage = externalCodeLanguage;

const symbolKind = (prefix: string): CodeSymbolProfile["kind"] => {
  if (/class/.test(prefix)) return "class";
  if (/interface|type|enum|struct/.test(prefix)) return "type";
  if (/function|def|fn|func/.test(prefix)) return "function";
  if (/export/.test(prefix)) return "export";
  if (/const|let|var/.test(prefix)) return "variable";
  return "unknown";
};

export const profileCode = (
  source: string,
  name: string,
  mediaType = "",
  limits = { maxBytes: 2_000_000, maxLines: 50_000, maxSymbols: 500 }
): CodeMaterialProfile => {
  const encoded = new TextEncoder().encode(source);
  const boundedSource = encoded.byteLength > limits.maxBytes
    ? new TextDecoder().decode(encoded.slice(0, limits.maxBytes))
    : source;
  let totalLines = 1;
  for (let index = source.indexOf("\n"); index >= 0; index = source.indexOf("\n", index + 1)) {
    totalLines += 1;
  }
  const sourceLines = boundedSource.split(/\r?\n/);
  const lines = sourceLines.slice(0, limits.maxLines);
  const truncated = encoded.byteLength > limits.maxBytes || totalLines > limits.maxLines;
  const imports = new Set<string>();
  const exports = new Set<string>();
  const symbols: CodeSymbolProfile[] = [];
  const declaration = /^\s*(export\s+)?(?:default\s+)?(async\s+)?(class|interface|type|enum|struct|function|def|fn|func|const|let|var)\s+([A-Za-z_$][\w$]*)/;
  lines.forEach((line, index) => {
    const importMatch = line.match(/^\s*(?:import\s+.*?from\s+|require\s*\(|use\s+|from\s+)(["']?)([^"';)\s]+)\1/);
    if (importMatch?.[2]) imports.add(importMatch[2].slice(0, 200));
    const exportMatch = line.match(/^\s*export\s+(?:default\s+)?(?:\{|\*\s+from\s+)?([A-Za-z_$][\w$]*)?/);
    if (exportMatch?.[1]) exports.add(exportMatch[1]);
    if (symbols.length >= limits.maxSymbols) return;
    const match = line.match(declaration);
    if (match?.[4]) symbols.push({
      name: match[4],
      kind: symbolKind(match[0]),
      fromLine: index + 1,
      toLine: index + 1
    });
  });
  return {
    kind: "code",
    language: codeLanguage(name, mediaType),
    lines: totalLines,
    imports: [...imports].slice(0, 200),
    exports: [...exports].slice(0, 200),
    symbols,
    parser: "bounded-regex",
    truncated,
    warnings: truncated ? ["The code profile reached a configured safety limit."] : []
  };
};
