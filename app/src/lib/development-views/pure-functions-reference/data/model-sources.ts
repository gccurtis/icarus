import type { SourceRecord } from "$development-views/pure-functions-reference/types";

const modules = import.meta.glob(
  [
    "/src/lib/model/client/configuration/index.ts",
    "/src/lib/model/client/configuration/types.ts",
    "/src/lib/model/client/configuration/state.ts",
    "/src/lib/model/client/configuration/port.ts",
    "/src/lib/model/client/configuration/methods/get-number/get-number.ts",
    "/src/lib/model/client/configuration/methods/get-number/select-number.ts",
    "/src/lib/runtime/client/models/types.ts",
    "/src/lib/runtime/client/models/build.ts",
    "/src/lib/runtime/client/start.ts"
  ],
  { query: "?raw", import: "default", eager: true }
);

const sourceOf = (path: string): string => {
  const source = modules[path];
  if (typeof source !== "string") throw new Error(`Reference source is missing: ${path}`);
  return source;
};

export const configurationModelSources = (
  serverAdmissionSource: string
): readonly SourceRecord[] => [
  {
    path: "src/lib/model/client/configuration/port.ts",
    label: "Port and adapter",
    role: "Defines the callable consumer surface and binds fresh acquire/commit/release leases around singleton state.",
    source: sourceOf("/src/lib/model/client/configuration/port.ts"),
    open: true
  },
  {
    path: "src/lib/model/client/configuration/state.ts",
    label: "State",
    role: "Declares 13 primitive stored fields and the one runtime-only state constructor.",
    source: sourceOf("/src/lib/model/client/configuration/state.ts"),
    open: true
  },
  {
    path: "src/lib/model/client/configuration/types.ts",
    label: "Local data contracts",
    role: "Closes both the admitted browser payload and every key a caller may request.",
    source: sourceOf("/src/lib/model/client/configuration/types.ts"),
    open: true
  },
  {
    path: "src/lib/model/client/configuration/methods/get-number/get-number.ts",
    label: "Public pure operation",
    role: "Receives state first and delegates the public getNumber decision to its local selector.",
    source: sourceOf("/src/lib/model/client/configuration/methods/get-number/get-number.ts"),
    open: true
  },
  {
    path: "src/lib/model/client/configuration/methods/get-number/select-number.ts",
    label: "Supporting pure operation",
    role: "Exhaustively maps the closed key vocabulary to concrete state fields.",
    source: sourceOf("/src/lib/model/client/configuration/methods/get-number/select-number.ts"),
    open: true
  },
  {
    path: "src/lib/model/client/configuration/index.ts",
    label: "Public type entry",
    role: "Exports data and acquired-port types, but no state constructor, binding function, or adapter value.",
    source: sourceOf("/src/lib/model/client/configuration/index.ts"),
    open: false
  },
  {
    path: "src/lib/runtime/client/models/types.ts",
    label: "Runtime adapter collection",
    role: "Names the migrated adapters runtime owns without exposing them to product consumers.",
    source: sourceOf("/src/lib/runtime/client/models/types.ts"),
    open: false
  },
  {
    path: "src/lib/runtime/client/models/build.ts",
    label: "Runtime construction and translation",
    role: "Creates and binds once, acquires once, translates all settings, commits, and releases in finally.",
    source: sourceOf("/src/lib/runtime/client/models/build.ts"),
    open: true
  },
  {
    path: "src/lib/runtime/client/start.ts",
    label: "Runtime holder",
    role: "Owns the one client graph instance and is the only importer of the split graph builder.",
    source: sourceOf("/src/lib/runtime/client/start.ts"),
    open: false
  },
  {
    path: "src/routes/app/[project]/+layout.server.ts",
    label: "Transport admission",
    role: "Publishes an exact numeric allowlist and rejects missing, mistyped, or non-finite values before serialization.",
    source: serverAdmissionSource,
    open: false
  }
];
