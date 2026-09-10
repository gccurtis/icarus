import type { FileSubkind } from "$representation/data/types/external/file";

const CODE_EXTENSIONS: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", rb: "ruby", rs: "rust",
  go: "go", java: "java", c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp",
  css: "css", html: "html", sql: "sql", sh: "shell", zsh: "shell",
  vue: "vue", svelte: "svelte", swift: "swift", kt: "kotlin", kts: "kotlin",
  json: "json", jsonl: "json", ndjson: "json", xml: "xml", yaml: "yaml", yml: "yaml",
  toml: "toml"
};

const CODE_MEDIA_TYPES: Record<string, string> = {
  "application/javascript": "javascript",
  "application/x-javascript": "javascript",
  "text/javascript": "javascript",
  "application/typescript": "typescript",
  "text/typescript": "typescript",
  "application/json": "json",
  "application/ld+json": "json",
  "application/x-ndjson": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/yaml": "yaml",
  "application/toml": "toml",
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

/** External owns format-family detection; semantic code profiling consumes it. */
export const externalCodeLanguage = (name: string, mediaType = ""): string => {
  const extension = name.toLowerCase().split(".").at(-1) ?? "";
  if (CODE_EXTENSIONS[extension] !== undefined) return CODE_EXTENSIONS[extension];
  const media = mediaType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  return CODE_MEDIA_TYPES[media] ?? (media.endsWith("+json")
    ? "json"
    : media.endsWith("+xml")
      ? "xml"
      : "unknown");
};

/** Deterministic subkind used by material adapters; callers may override `unknown`. */
export const fileSubkindFor = (mediaType: string, name = ""): FileSubkind => {
  const media = mediaType.toLowerCase();
  const lowerName = name.toLowerCase();
  if (media.startsWith("image/")) return "image";
  if (media.startsWith("audio/")) return "audio";
  if (media.startsWith("video/")) return "video";
  // These media types are produced by byte signatures. Their binary/container
  // identity must win over a misleading prose, code, or data filename.
  if (media === "application/pdf" || media === "application/zip") return "unknown";
  if (
    media.includes("csv") ||
    media.includes("tab-separated") ||
    media.includes("json") ||
    media.includes("xml") ||
    /\.(csv|tsv|json|jsonl|ndjson|xml|yaml|yml|toml)$/.test(lowerName)
  ) {
    return "data";
  }
  if (externalCodeLanguage(name, mediaType) !== "unknown") return "code";
  if (
    media === "text/plain" ||
    media === "text/markdown" ||
    media === "text/x-markdown" ||
    /\.(txt|text|md|markdown|rst)$/.test(lowerName)
  ) return "text";
  return "unknown";
};

/** A browser folder selection becomes safe metadata, never a server filesystem path. */
export const normalizeExternalRelativePath = (value: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("an external file path is required");
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("an external file path cannot contain control characters");
  }
  const normalized = value.normalize("NFC").replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) {
    throw new Error("an external file path must be relative");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("an external file path cannot contain empty or traversal segments");
  }
  return normalized;
};

/** Applies the one configured UTF-8 path limit after canonicalization. */
export const externalRelativePathWithin = (value: string, maxBytes: number): string => {
  const normalized = normalizeExternalRelativePath(value);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("an external file path limit must be a positive safe integer");
  }
  if (new TextEncoder().encode(normalized).byteLength > maxBytes) {
    throw new Error(`an external file path exceeds ${maxBytes} UTF-8 bytes`);
  }
  return normalized;
};

export const externalFileNameIn = (relativePath: string): string => {
  const name = relativePath.split("/").at(-1);
  if (name === undefined || name.length === 0) throw new Error("an external file name is required");
  return name;
};

/** Empty string is the virtual External root and never a native filesystem path. */
export const normalizeExternalDirectoryPath = (value: string): string => {
  if (value === "") return "";
  const normalized = normalizeExternalRelativePath(value);
  if (normalized.endsWith("/")) throw new Error("an external directory path has no trailing slash");
  return normalized;
};

export const externalDirectoryIn = (relativePath: string): string => {
  const segments = normalizeExternalRelativePath(relativePath).split("/");
  return segments.length === 1 ? "" : segments.slice(0, -1).join("/");
};

export const externalDirectoryNameIn = (path: string): string => {
  const normalized = normalizeExternalDirectoryPath(path);
  return normalized === "" ? "External" : normalized.split("/").at(-1)!;
};

export const externalDirectoryParentIn = (path: string): string | null => {
  const normalized = normalizeExternalDirectoryPath(path);
  if (normalized === "") return null;
  const segments = normalized.split("/");
  return segments.length === 1 ? "" : segments.slice(0, -1).join("/");
};

export const externalPathIn = (directory: string, name: string): string => {
  const normalized = normalizeExternalDirectoryPath(directory);
  return normalizeExternalRelativePath(normalized === "" ? name : `${normalized}/${name}`);
};

/** A virtual path cannot be both a file and a directory in the same project. */
export const externalPathsConflict = (left: string, right: string): boolean => {
  const one = normalizeExternalRelativePath(left);
  const other = normalizeExternalRelativePath(right);
  return one === other || one.startsWith(`${other}/`) || other.startsWith(`${one}/`);
};

export const externalPathSetHasConflicts = (paths: readonly string[]): boolean => {
  const normalized = paths.map(normalizeExternalRelativePath);
  const exact = new Set(normalized);
  if (exact.size !== normalized.length) return true;
  return normalized.some((path) => {
    const segments = path.split("/");
    return segments.slice(0, -1).some((_, index) =>
      exact.has(segments.slice(0, index + 1).join("/"))
    );
  });
};

export const externalDirectoryContains = (directory: string, relativePath: string): boolean => {
  const normalized = normalizeExternalDirectoryPath(directory);
  const path = normalizeExternalRelativePath(relativePath);
  return normalized === "" || path.startsWith(`${normalized}/`);
};

/** A small signature reconciler; unknown types stay safely downloadable. */
export const mediaTypeForExternalBytes = (
  bytes: Uint8Array,
  declared: string,
  name: string
): string => {
  const starts = (...values: number[]): boolean =>
    values.every((value, index) => bytes[index] === value);
  const candidate = declared.trim().toLowerCase().split(";", 1)[0] ?? "";
  const supplied = /^[a-z0-9][a-z0-9!#$&^_.+~-]*\/[a-z0-9][a-z0-9!#$&^_.+~-]*$/.test(candidate)
    ? candidate
    : "";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (starts(0x50, 0x4b, 0x03, 0x04)) return "application/zip";
  if (starts(0x49, 0x44, 0x33) || starts(0xff, 0xfb)) return "audio/mpeg";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) return "audio/wav";
  if (
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) return "video/mp4";
  const lower = name.toLowerCase();
  if (/\.csv$/.test(lower)) return "text/csv";
  if (/\.tsv$/.test(lower)) return "text/tab-separated-values";
  if (/\.json$/.test(lower)) return "application/json";
  if (/\.(jsonl|ndjson)$/.test(lower)) return "application/x-ndjson";
  if (/\.ya?ml$/.test(lower)) return "application/yaml";
  if (/\.toml$/.test(lower)) return "application/toml";
  if (/\.xml$/.test(lower)) return "application/xml";
  if (/\.md$/.test(lower)) return "text/markdown";
  if (/\.tsx?$/.test(lower)) return "text/typescript";
  if (/\.jsx?$/.test(lower)) return "text/javascript";
  if (/\.(txt|text|rst)$/.test(lower)) return "text/plain";
  if (/\.(py|rb|rs|go|java|c|cc|cpp|h|hpp|css|html|sql|sh|zsh|vue|svelte|swift|kt|kts)$/.test(lower)) {
    return "text/plain";
  }
  if (supplied && supplied !== "application/octet-stream") return supplied;
  return "application/octet-stream";
};
