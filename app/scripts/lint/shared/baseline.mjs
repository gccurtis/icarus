import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BASELINE_PATH = "configuration/architecture-baseline.json";
const CATALOG_PATH = "configuration/architecture-checkers.json";
const catalogCache = new Map();

export const fingerprintOf = (failure) =>
  failure.fingerprint ??
  createHash("sha256").update(failure.message).digest("hex").slice(0, 16);

export const findingKey = ({ checker, path, subject = "", fingerprint }) =>
  `${checker}|${subject}|${path}|${fingerprint}`;

export const readBaseline = (base) => {
  const path = join(base, BASELINE_PATH);
  if (!existsSync(path)) return { version: 1, findings: [] };
  return JSON.parse(readFileSync(path, "utf8"));
};

const contractOf = (base, implementation, definition) => {
  if (definition.id) return definition.id;
  if (!catalogCache.has(base)) {
    const path = join(base, CATALOG_PATH);
    const contracts = existsSync(path)
      ? JSON.parse(readFileSync(path, "utf8")).contracts ?? {}
      : {};
    const reverse = new Map();
    for (const [contract, implementations] of Object.entries(contracts)) {
      for (const candidate of implementations) {
        if (!reverse.has(candidate)) reverse.set(candidate, contract);
      }
    }
    catalogCache.set(base, reverse);
  }
  return catalogCache.get(base).get(implementation) ?? "UNMAPPED";
};

export const baselineRecord = (treeName, definition, tree, failure) => {
  const implementation = `${treeName}/${definition.name}.mjs`;
  return {
    checker: definition.name,
    contract: contractOf(tree.base, implementation, definition),
    pillar: treeName,
    path: tree.rel(failure.path),
    ...(failure.subject ? { subject: failure.subject } : {}),
    fingerprint: fingerprintOf(failure),
    finding: definition.finding ?? definition.id ?? "architecture-audit",
    owner: "architecture-remediation",
    rationale: "Pre-existing structural debt captured when this checker became blocking",
    removal: `Remove when ${definition.name} reports clean for this structure`,
    review: "2027-03-01"
  };
};
