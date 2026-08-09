import { createHash, randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type {
  FormulaDiagnostic,
  FormulaEngine,
  FormulaExpression,
  FormulaResolverSnapshot,
  FormulaValue
} from "#formula";
import { makeList, makeLogic, makeNumber, makeRecord, makeTable, makeText, NULL_VALUE, fromDecimalString } from "#formula";
import { normalizeKey } from "#formula/resolver.js";
import { formulaValueDigest } from "#formula/value-identity.js";
import type { StructuredData, DataEntry, CollectionEntry, CellValue } from "#structured-data";

export interface FormulaNameResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
  getIssue(entryId: string): FormulaResolutionIssue | undefined;
}

export type FormulaResolutionIssueCode =
  | "parse_error"
  | "evaluation_error"
  | "invalid_collection"
  | "unresolved_dependency"
  | "cycle_error";

export interface FormulaResolutionIssue {
  readonly entryId: string;
  readonly displayName: string;
  readonly entryKind: DataEntry["kind"];
  readonly code: FormulaResolutionIssueCode;
  readonly diagnostics: readonly FormulaDiagnostic[];
  readonly dependencies?: readonly string[];
}

interface ResolverConfig {
  readonly userId: string;
  readonly projectId: string;
}

type ResolverBinding = FormulaResolverSnapshot["bindings"] extends ReadonlyMap<string, infer T> ? T : never;

function digestSnapshot(bindings: ReadonlyMap<string, ResolverBinding>): string {
  const payload = [...bindings.entries()]
    .map(([normalizedName, binding]) => ({
      normalizedName: normalizeKey(normalizedName),
      bindingId: binding.reference.bindingId,
      ownerRevision: binding.ownerRevision,
      valueDigest: binding.valueDigest
    }))
    .sort((left, right) => {
      if (left.normalizedName !== right.normalizedName) {
        return left.normalizedName < right.normalizedName ? -1 : 1;
      }
      return left.bindingId < right.bindingId ? -1 : left.bindingId > right.bindingId ? 1 : 0;
    });
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
}

function isCellFormula(value: CellValue): value is { formula: string } {
  return typeof value === "object" && value !== null && "formula" in value && typeof (value as { formula?: unknown }).formula === "string";
}

function literalToFormulaValue(v: string | number | boolean | null): FormulaValue {
  if (v === null) return NULL_VALUE;
  if (typeof v === "string") return makeText(v);
  if (typeof v === "number") return makeNumber(fromDecimalString(String(v)));
  if (typeof v === "boolean") return makeLogic(v);
  return NULL_VALUE;
}

type ResolvedEntry = { readonly kind: "resolved"; readonly value: FormulaValue };
type WaitingEntry = { readonly kind: "waiting"; readonly dependencies: readonly string[] };
type FailedEntry = {
  readonly kind: "failed";
  readonly code: Exclude<FormulaResolutionIssueCode, "unresolved_dependency" | "cycle_error">;
  readonly diagnostics: readonly FormulaDiagnostic[];
};
type EntryResolution = ResolvedEntry | WaitingEntry | FailedEntry;

function contextualizeDiagnostics(
  diagnostics: readonly FormulaDiagnostic[],
  context: string
): FormulaDiagnostic[] {
  return diagnostics.map(diagnostic => ({
    ...diagnostic,
    message: `${context}: ${diagnostic.message}`
  }));
}

function diagnostic(code: FormulaDiagnostic["code"], message: string): FormulaDiagnostic {
  return { code, message };
}

function valueMatchesField(value: FormulaValue, expectedKind: CollectionEntry["schema"][number]["kind"]): boolean {
  if (value.kind === "null") return true;
  if (value.kind === "function") return false;
  return expectedKind === "unknown" || value.kind === expectedKind;
}

class FormulaNameResolverImpl implements FormulaNameResolver {
  private cachedEntriesSignature = "";
  private cachedSnapshot: FormulaResolverSnapshot | null = null;
  private readonly issuesByEntryId = new Map<string, FormulaResolutionIssue>();

  constructor(
    private readonly formula: FormulaEngine,
    private readonly projectStructuredData: StructuredData,
    private readonly logger: Logger,
    private readonly cfg: ResolverConfig
  ) {}

  getIssue(entryId: string): FormulaResolutionIssue | undefined {
    return this.issuesByEntryId.get(entryId);
  }

  async buildSnapshot(): Promise<FormulaResolverSnapshot> {
    const start = performance.now();
    const view = await this.projectStructuredData.bindingView();
    const entries = [...view.entries.values()];
    const entriesSignature = createHash("sha256")
      .update(
        entries
          .map((e) => `${e.id}:${e.revision}:${e.displayName}:${e.kind}`)
          .sort()
          .join("|")
      )
      .digest("hex")
      .slice(0, 32);

    if (this.cachedSnapshot && this.cachedEntriesSignature === entriesSignature) {
      this.logger.debug("formula-resolver.snapshot.cache-hit", { entriesSignature });
      return this.cachedSnapshot;
    }

    const bindings = new Map<string, ResolverBinding>();

    const addBinding = (entry: DataEntry, value: FormulaValue): void => {
      const key = normalizeKey(entry.displayName);
      const valueDigest = formulaValueDigest(value);
      bindings.set(key, {
        reference: {
          kind: "binding",
          bindingId: entry.id,
          ownerRevision: entry.revision,
          valueDigest
        },
        displayName: entry.displayName,
        normalizedLookupKey: key,
        value,
        ownerRevision: entry.revision,
        valueDigest
      });
    };

    this.issuesByEntryId.clear();

    // Resolve every entry iteratively. Literal collections settle immediately;
    // formula-backed cells wait for the same bindings as variables/functions,
    // which makes resolution independent of display-name ordering.
    const unresolved = [...entries];
    const waitingDependencies = new Map<string, readonly string[]>();
    const maxPasses = entries.length + 1;
    let pass = 0;
    while (unresolved.length > 0 && pass < maxPasses) {
      pass += 1;
      let progress = false;
      const stillUnresolved: DataEntry[] = [];

      for (const entry of unresolved) {
        const resolution = this.resolveEntry(entry, bindings);
        if (resolution.kind === "waiting") {
          waitingDependencies.set(entry.id, resolution.dependencies);
          stillUnresolved.push(entry);
          continue;
        }
        waitingDependencies.delete(entry.id);
        if (resolution.kind === "failed") {
          const issue: FormulaResolutionIssue = {
            entryId: entry.id,
            displayName: entry.displayName,
            entryKind: entry.kind,
            code: resolution.code,
            diagnostics: resolution.diagnostics
          };
          this.issuesByEntryId.set(entry.id, issue);
          this.logger.warn("formula-resolver.entry-failed", issue);
          progress = true;
          continue;
        }
        addBinding(entry, resolution.value);
        progress = true;
      }

      unresolved.length = 0;
      unresolved.push(...stillUnresolved);
      if (!progress) break;
    }

    // Leftovers are cyclic or refer to declarations that do not exist. They
    // remain absent from the Formula value algebra; null is reserved for an
    // authored null value.
    const unresolvedKeys = new Set(unresolved.map(entry => normalizeKey(entry.displayName)));
    for (const entry of unresolved) {
      if (!bindings.has(normalizeKey(entry.displayName))) {
        const dependencies = waitingDependencies.get(entry.id) ?? [];
        const isCycle = dependencies.length > 0 && dependencies.every(name => unresolvedKeys.has(normalizeKey(name)));
        const code: FormulaResolutionIssueCode = isCycle ? "cycle_error" : "unresolved_dependency";
        const issue: FormulaResolutionIssue = {
          entryId: entry.id,
          displayName: entry.displayName,
          entryKind: entry.kind,
          code,
          dependencies,
          diagnostics: [diagnostic(
            isCycle ? "cycle_error" : "unknown_identifier",
            isCycle
              ? `Cyclic dependency while resolving ${entry.displayName}`
              : `Unresolved dependencies for ${entry.displayName}: ${dependencies.join(", ") || "unknown"}`
          )]
        };
        this.issuesByEntryId.set(entry.id, issue);
        this.logger.warn("formula-resolver.unresolved-binding", issue);
      }
    }

    const snapshot = this.makeSnapshotFromBindings(bindings, entries);
    this.cachedEntriesSignature = entriesSignature;
    this.cachedSnapshot = snapshot;

    const durationMs = Math.round(performance.now() - start);
    this.logger.debug("formula-resolver.snapshot-built", {
      bindingCount: snapshot.bindings.size,
      entriesSignature,
      passCount: pass,
      unresolvedCount: unresolved.length,
      failureCount: this.issuesByEntryId.size,
      durationMs
    });

    return snapshot;
  }

  private resolveEntry(
    entry: DataEntry,
    bindings: ReadonlyMap<string, ResolverBinding>
  ): EntryResolution {
    if (entry.kind === "table" || entry.kind === "record" || entry.kind === "list") {
      return this.resolveCollection(entry, bindings);
    }

    const formulaEntry = entry as Extract<DataEntry, { kind: "variable" | "function" }>;
    const parsed = this.formula.parse({ source: formulaEntry.body, languageVersion: "formula/v1" });
    if (!parsed.ok || !parsed.value) {
      return {
        kind: "failed",
        code: "parse_error",
        diagnostics: contextualizeDiagnostics(parsed.diagnostics ?? [], entry.displayName)
      };
    }
    const snapshot = this.makeSnapshotFromBindings(bindings);
    const dependencies = this.formula.dependencies({ expression: parsed.value, resolver: snapshot });
    if (!dependencies.ok || !dependencies.value) {
      return {
        kind: "failed",
        code: "evaluation_error",
        diagnostics: contextualizeDiagnostics(dependencies.diagnostics ?? [], entry.displayName)
      };
    }
    const missing = dependencies.value.symbolic
      .map(dependency => dependency.name)
      .filter(name => !bindings.has(normalizeKey(name)));
    if (missing.length > 0) {
      return { kind: "waiting", dependencies: [...new Set(missing)] };
    }
    const evaluated = this.formula.evaluate({ expression: parsed.value, resolver: snapshot });
    if (!evaluated.ok || !evaluated.value) {
      return {
        kind: "failed",
        code: "evaluation_error",
        diagnostics: contextualizeDiagnostics(evaluated.diagnostics ?? [], entry.displayName)
      };
    }
    if (entry.kind === "function" && evaluated.value.value.kind !== "function") {
      return {
        kind: "failed",
        code: "evaluation_error",
        diagnostics: [diagnostic("type_error", `${entry.displayName}: function declarations must evaluate to a function`)]
      };
    }
    return { kind: "resolved", value: evaluated.value.value };
  }

  private resolveCollection(
    entry: CollectionEntry,
    bindings: ReadonlyMap<string, ResolverBinding>
  ): EntryResolution {
    const fields = entry.schema.map((f) => f.name);
    if (entry.kind === "list" && fields.length !== 1) {
      return {
        kind: "failed",
        code: "invalid_collection",
        diagnostics: [diagnostic("invalid_table", `${entry.displayName}: list entries require exactly one field`)]
      };
    }
    if (entry.kind === "record" && entry.rows.length !== 1) {
      return {
        kind: "failed",
        code: "invalid_collection",
        diagnostics: [diagnostic("invalid_table", `${entry.displayName}: record entries require exactly one row`)]
      };
    }

    const snapshot = this.makeSnapshotFromBindings(bindings);
    const parsedCells = new Map<string, FormulaExpression>();
    const missing = new Set<string>();

    for (let rowIndex = 0; rowIndex < entry.rows.length; rowIndex += 1) {
      for (let fieldIndex = 0; fieldIndex < entry.schema.length; fieldIndex += 1) {
        const field = entry.schema[fieldIndex];
        const raw = entry.rows[rowIndex][field.name] ?? null;
        if (!isCellFormula(raw)) continue;
        const path = `${entry.displayName}[${rowIndex}].${field.name}`;
        const parsed = this.formula.parse({ source: raw.formula, languageVersion: "formula/v1" });
        if (!parsed.ok || !parsed.value) {
          return {
            kind: "failed",
            code: "parse_error",
            diagnostics: contextualizeDiagnostics(parsed.diagnostics ?? [], path)
          };
        }
        const dependencies = this.formula.dependencies({ expression: parsed.value, resolver: snapshot });
        if (!dependencies.ok || !dependencies.value) {
          return {
            kind: "failed",
            code: "evaluation_error",
            diagnostics: contextualizeDiagnostics(dependencies.diagnostics ?? [], path)
          };
        }
        dependencies.value.symbolic.forEach(dependency => {
          if (!bindings.has(normalizeKey(dependency.name))) missing.add(dependency.name);
        });
        parsedCells.set(`${rowIndex}:${fieldIndex}`, parsed.value);
      }
    }
    if (missing.size > 0) {
      return { kind: "waiting", dependencies: [...missing] };
    }

    const rows: FormulaValue[][] = [];
    for (let rowIndex = 0; rowIndex < entry.rows.length; rowIndex += 1) {
      const values: FormulaValue[] = [];
      for (let fieldIndex = 0; fieldIndex < entry.schema.length; fieldIndex += 1) {
        const field = entry.schema[fieldIndex];
        const raw = entry.rows[rowIndex][field.name] ?? null;
        const path = `${entry.displayName}[${rowIndex}].${field.name}`;
        let value: FormulaValue;
        if (isCellFormula(raw)) {
          const evaluated = this.formula.evaluate({
            expression: parsedCells.get(`${rowIndex}:${fieldIndex}`)!,
            resolver: snapshot
          });
          if (!evaluated.ok || !evaluated.value) {
            return {
              kind: "failed",
              code: "evaluation_error",
              diagnostics: contextualizeDiagnostics(evaluated.diagnostics ?? [], path)
            };
          }
          value = evaluated.value.value;
        } else if (
          raw === null ||
          typeof raw === "string" ||
          typeof raw === "number" ||
          typeof raw === "boolean"
        ) {
          value = literalToFormulaValue(raw);
        } else {
          return {
            kind: "failed",
            code: "invalid_collection",
            diagnostics: [diagnostic("invalid_table", `${path}: unsupported cell value`)]
          };
        }
        if (!valueMatchesField(value, field.kind)) {
          return {
            kind: "failed",
            code: "invalid_collection",
            diagnostics: [diagnostic(
              "type_error",
              `${path}: expected ${field.kind}, evaluated to ${value.kind}`
            )]
          };
        }
        values.push(value);
      }
      rows.push(values);
    }

    if (entry.kind === "list") {
      const elements = rows.map((r) => r[0] ?? NULL_VALUE);
      return { kind: "resolved", value: makeList(elements) };
    }
    if (entry.kind === "record") {
      return { kind: "resolved", value: makeRecord(fields, rows[0]) };
    }
    return { kind: "resolved", value: makeTable(fields, rows) };
  }

  private makeSnapshotFromBindings(
    bindings: ReadonlyMap<string, ResolverBinding>,
    sourceEntries?: readonly DataEntry[]
  ): FormulaResolverSnapshot {
    const createdFrom = (sourceEntries ?? []).map((e) => ({ sourceId: e.id, revision: e.revision }));
    return {
      id: randomUUID(),
      scope: { userId: this.cfg.userId, projectId: this.cfg.projectId },
      bindings,
      snapshotDigest: digestSnapshot(bindings),
      createdFrom
    };
  }
}

export function createFormulaNameResolver(
  formula: FormulaEngine,
  projectStructuredData: StructuredData,
  logger: Logger,
  config: { userId: string; projectId: string }
): FormulaNameResolver {
  return new FormulaNameResolverImpl(formula, projectStructuredData, logger, {
    userId: config.userId,
    projectId: config.projectId
  });
}
