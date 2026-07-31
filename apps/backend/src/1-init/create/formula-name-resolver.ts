import { createHash, randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { FormulaEngine, FormulaResolverSnapshot, FormulaValue } from "#formula";
import { makeList, makeLogic, makeNumber, makeRecord, makeTable, makeText, NULL_VALUE, toWire, fromDecimalString } from "#formula";
import { normalizeKey } from "#formula/resolver.js";
import type { StructuredData, DataEntry, CollectionEntry, CellValue, DataRow } from "#structured-data";

export interface FormulaNameResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
}

interface ResolverConfig {
  readonly userId: string;
  readonly projectId: string;
  readonly maxPasses: number;
}

const DEFAULT_MAX_PASSES = 32;

function digestValue(v: FormulaValue): string {
  return createHash("sha256").update(JSON.stringify(toWire(v))).digest("hex").slice(0, 32);
}

function digestSnapshot(bindings: ReadonlyMap<string, string>): string {
  const payload = [...bindings.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, d]) => `${k}:${d}`)
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
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

class FormulaNameResolverImpl implements FormulaNameResolver {
  private cachedEntriesSignature = "";
  private cachedSnapshot: FormulaResolverSnapshot | null = null;

  constructor(
    private readonly formula: FormulaEngine,
    private readonly projectStructuredData: StructuredData,
    private readonly logger: Logger,
    private readonly cfg: ResolverConfig
  ) {}

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

    const bindings = new Map<string, FormulaResolverSnapshot["bindings"] extends ReadonlyMap<string, infer T> ? T : never>();
    const digestMap = new Map<string, string>();

    const addBinding = (entry: DataEntry, value: FormulaValue): void => {
      const key = normalizeKey(entry.displayName);
      const valueDigest = digestValue(value);
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
      digestMap.set(key, valueDigest);
    };

    // Pass 0: direct collection translations (table/record/list).
    for (const entry of entries) {
      if (entry.kind === "table" || entry.kind === "record" || entry.kind === "list") {
        addBinding(entry, this.collectionToValue(entry, bindings));
      }
    }

    // Pass N: text-backed entries (function + variable), resolving dependencies iteratively.
    const unresolved = entries.filter((e) => e.kind === "function" || e.kind === "variable");
    let pass = 0;
    while (unresolved.length > 0 && pass < this.cfg.maxPasses) {
      pass += 1;
      let progress = false;
      const stillUnresolved: DataEntry[] = [];

      for (const entry of unresolved) {
        const source = (entry as Extract<DataEntry, { kind: "variable" | "function" }>).body;
        const parseResult = this.formula.parse({ source, languageVersion: "formula/v1" });
        if (!parseResult.ok || !parseResult.value) {
          this.logger.warn("formula-resolver.parse-failed", { displayName: entry.displayName, kind: entry.kind, diagnostics: parseResult.diagnostics });
          addBinding(entry, NULL_VALUE);
          progress = true;
          continue;
        }

        const snapshot = this.makeSnapshotFromBindings(bindings, digestMap);
        const depsResult = this.formula.dependencies({ expression: parseResult.value, resolver: snapshot });
        if (!depsResult.ok || !depsResult.value) {
          stillUnresolved.push(entry);
          continue;
        }

        const symbolicUnresolved = depsResult.value.symbolic.filter((d) => !bindings.has(normalizeKey(d.name)));
        if (symbolicUnresolved.length > 0) {
          stillUnresolved.push(entry);
          continue;
        }

        const evalResult = this.formula.evaluate({ expression: parseResult.value, resolver: snapshot });
        if (!evalResult.ok || !evalResult.value) {
          this.logger.warn("formula-resolver.eval-failed", { displayName: entry.displayName, kind: entry.kind, diagnostics: evalResult.diagnostics });
          addBinding(entry, NULL_VALUE);
          progress = true;
          continue;
        }

        addBinding(entry, evalResult.value.value);
        progress = true;
      }

      unresolved.length = 0;
      unresolved.push(...stillUnresolved);
      if (!progress) break;
    }

    // Leftovers are cyclic/unsatisfied dependencies.
    for (const entry of unresolved) {
      if (!bindings.has(normalizeKey(entry.displayName))) {
        this.logger.warn("formula-resolver.unresolved-binding", { displayName: entry.displayName, kind: entry.kind, revision: entry.revision });
        addBinding(entry, NULL_VALUE);
      }
    }

    const snapshot = this.makeSnapshotFromBindings(bindings, digestMap, entries);
    this.cachedEntriesSignature = entriesSignature;
    this.cachedSnapshot = snapshot;

    const durationMs = Math.round(performance.now() - start);
    this.logger.debug("formula-resolver.snapshot-built", {
      bindingCount: snapshot.bindings.size,
      entriesSignature,
      passCount: pass,
      unresolvedCount: unresolved.length,
      durationMs
    });

    return snapshot;
  }

  private collectionToValue(
    entry: CollectionEntry,
    bindings: ReadonlyMap<string, FormulaResolverSnapshot["bindings"] extends ReadonlyMap<string, infer T> ? T : never>
  ): FormulaValue {
    const fields = entry.schema.map((f) => f.name);
    const rows = entry.rows.map((row) => this.rowToFormulaRow(fields, row, bindings));

    if (entry.kind === "list") {
      const elements = rows.map((r) => r[0] ?? NULL_VALUE);
      return makeList(elements);
    }
    if (entry.kind === "record") {
      const first = rows[0] ?? fields.map(() => NULL_VALUE);
      return makeRecord(fields, first);
    }
    return makeTable(fields, rows);
  }

  private rowToFormulaRow(
    fields: string[],
    row: DataRow,
    bindings: ReadonlyMap<string, FormulaResolverSnapshot["bindings"] extends ReadonlyMap<string, infer T> ? T : never>
  ): FormulaValue[] {
    const snapshot = this.makeSnapshotFromBindings(new Map(bindings), new Map());
    return fields.map((field) => {
      const raw = row[field] ?? null;
      if (isCellFormula(raw)) {
        const parsed = this.formula.parse({ source: raw.formula, languageVersion: "formula/v1" });
        if (!parsed.ok || !parsed.value) return NULL_VALUE;
        const evaluated = this.formula.evaluate({ expression: parsed.value, resolver: snapshot });
        return evaluated.ok && evaluated.value ? evaluated.value.value : NULL_VALUE;
      }
      if (typeof raw === "object") return NULL_VALUE;
      return literalToFormulaValue(raw);
    });
  }

  private makeSnapshotFromBindings(
    bindings: ReadonlyMap<string, FormulaResolverSnapshot["bindings"] extends ReadonlyMap<string, infer T> ? T : never>,
    digestMap: ReadonlyMap<string, string>,
    sourceEntries?: readonly DataEntry[]
  ): FormulaResolverSnapshot {
    const createdFrom = (sourceEntries ?? []).map((e) => ({ sourceId: e.id, revision: e.revision }));
    return {
      id: randomUUID(),
      scope: { userId: this.cfg.userId, projectId: this.cfg.projectId },
      bindings,
      snapshotDigest: digestSnapshot(digestMap),
      createdFrom
    };
  }
}

export function createFormulaNameResolver(
  formula: FormulaEngine,
  projectStructuredData: StructuredData,
  logger: Logger,
  config: { userId: string; projectId: string; maxPasses?: number }
): FormulaNameResolver {
  return new FormulaNameResolverImpl(formula, projectStructuredData, logger, {
    userId: config.userId,
    projectId: config.projectId,
    maxPasses: config.maxPasses ?? DEFAULT_MAX_PASSES
  });
}
