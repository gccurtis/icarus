import type { CodeMaterialProfile, CodeSymbolProfile } from "$representation/data/types/semantic/material";

const EXTENSIONS: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", rb: "ruby", rs: "rust",
  go: "go", java: "java", c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp",
  css: "css", html: "html", sql: "sql", sh: "shell", zsh: "shell",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml"
};

const MEDIA_TYPES: Record<string, string> = {
  "application/javascript": "javascript",
  "application/x-javascript": "javascript",
  "text/javascript": "javascript",
  "application/typescript": "typescript",
  "text/typescript": "typescript",
  "application/json": "json",
  "application/ld+json": "json",
  "application/sql": "sql",
  "text/css": "css",
  "text/html": "html",
  "text/x-python": "python",
  "text/x-ruby": "ruby",
  "text/x-rust": "rust",
  "text/x-go": "go",
  "text/x-java-source": "java",
  "application/x-sh": "shell",
  "text/x-shellscript": "shell"
};

export const codeLanguage = (name: string, mediaType = ""): string => {
  const extension = name.toLowerCase().split(".").at(-1) ?? "";
  if (EXTENSIONS[extension] !== undefined) return EXTENSIONS[extension];
  return MEDIA_TYPES[mediaType.toLowerCase().split(";")[0].trim()] ?? "unknown";
};

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
