import { basename, dirname, join } from "node:path";

import ts from "typescript";

import { check } from "../shared/check.mjs";
import {
  recordProperty,
  registryDeclaration,
  registryPath,
  registryRecords,
  remotePath,
  remoteRegistryReferences,
  stringValue
} from "../shared/capability-registry.mjs";
import { lineOf, literalStrings, propertyValue, unwrap } from "../shared/pure-contract.mjs";
import { capabilities, procedureEntries, unitOf } from "../shared/trees.mjs";
import { repositoryProgram } from "../shared/typescript-program.mjs";

const operationId = (capability, path) => `${capability.name}.${basename(path, ".ts")}`;

const referencedDeclarations = (compiler, expression) => {
  const value = unwrap(expression);
  const name = ts.isPropertyAccessExpression(value)
    ? value.name
    : ts.isElementAccessExpression(value)
      ? value.expression
      : value;
  return compiler.declarationPaths(compiler.symbolAt(name));
};

export default check({
  name: "capability-registry-is-bijective",
  baseline: false,
  says: "Capability entries, admission, transformers, registry records, bindings, and remote exports form one static bijection.",
  subjects: {
    manifest: "one deeply frozen static registry is the canonical manifest",
    completeness: "every capability operation has exactly one registry record and no record is orphaned",
    record: "each record names its owner, invocation policy, admission, entry, transformer, models, and commit policy",
    provenance: "record references resolve to the matching capability and runtime adapter",
    remote: "the remotely callable registry subset exactly matches generated remote exports",
    determinism: "registry and remote records are unique and sorted"
  },
  run(tree) {
    const compiler = repositoryProgram(tree);
    const found = [];
    const units = capabilities(tree);
    const expected = new Map(
      procedureEntries(tree).map((path) => {
        const capability = unitOf(tree, units, path);
        return [operationId(capability, path), { capability, path }];
      })
    );
    const declaration = registryDeclaration(tree);
    const path = registryPath(tree);

    if (!declaration?.declaration || !declaration.literal || !declaration.frozen) {
      found.push({
        subject: "manifest",
        path,
        line: 1,
        fingerprint: "missing-static-registry",
        message: "runtime must export capabilityRegistry as one Object.freeze({...}) literal"
      });
    }

    const records = registryRecords(declaration);
    const names = records.map(({ name }) => name);
    if (new Set(names).size !== names.length || [...names].sort().join("\0") !== names.join("\0")) {
      found.push({
        subject: "determinism",
        path,
        line: 1,
        fingerprint: `registry-order:${names.join(",")}`,
        message: "registry operation keys must be unique and sorted"
      });
    }

    const byName = new Map(records.map((record) => [record.name, record]));
    for (const [name, entry] of expected) {
      if (byName.has(name)) continue;
      found.push({
        subject: "completeness",
        path: entry.path,
        line: 1,
        fingerprint: `missing:${name}`,
        message: `${name} has no static runtime registry record`
      });
    }
    for (const record of records) {
      if (!expected.has(record.name)) {
        found.push({
          subject: "completeness",
          path,
          line: lineOf(declaration.source, record.property),
          fingerprint: `orphan:${record.name}`,
          message: `${record.name} is registered but has no matching capability operation entry`
        });
      }

      if (!record.object?.literal || !record.object.frozen) {
        found.push({
          subject: "manifest",
          path,
          line: lineOf(declaration.source, record.property),
          fingerprint: `unfrozen:${record.name}`,
          message: `${record.name} registry record is not an explicitly frozen literal`
        });
        continue;
      }

      const required = ["owner", "kind", "scope", "admit", "entry", "transformer", "models", "commit"];
      const missing = required.filter((name) => !recordProperty(record, name));
      const allowed = new Set([...required, "checkpoints", "transport"]);
      const extra = record.object.literal.properties
        .map((property) => property.name?.getText(declaration.source).replace(/^['"]|['"]$/g, ""))
        .filter((name) => !allowed.has(name));
      if (missing.length > 0 || extra.length > 0) {
        found.push({
          subject: "record",
          path,
          line: lineOf(declaration.source, record.property),
          fingerprint: `${record.name}:shape:${missing.join(",")}:${extra.join(",")}`,
          message: `${record.name} is missing ${missing.join(", ") || "nothing"} and adds ${extra.join(", ") || "nothing"}`
        });
      }

      const owner = stringValue(propertyValue(recordProperty(record, "owner")));
      const kind = stringValue(propertyValue(recordProperty(record, "kind")));
      const scope = stringValue(propertyValue(recordProperty(record, "scope")));
      const commit = stringValue(propertyValue(recordProperty(record, "commit")));
      const checkpoints = literalStrings(propertyValue(recordProperty(record, "checkpoints")));
      const models = literalStrings(propertyValue(recordProperty(record, "models")));
      if (
        owner !== record.name.split(".")[0] ||
        !["query", "command", "form", "prerender", "internal"].includes(kind) ||
        !["project", "session", "public", "system"].includes(scope) ||
        !["automatic", "checkpointed"].includes(commit) ||
        (commit === "checkpointed" && (!checkpoints || checkpoints.length === 0)) ||
        (commit === "automatic" && checkpoints !== null) ||
        !models ||
        new Set(models).size !== models.length ||
        [...models].sort().join("\0") !== models.join("\0")
      ) {
        found.push({
          subject: "record",
          path,
          line: lineOf(declaration.source, record.property),
          fingerprint: `${record.name}:policy`,
          message: `${record.name} has a non-literal owner/kind/scope/commit policy or unsorted model list`
        });
      }

      const expectedEntry = expected.get(record.name);
      if (expectedEntry) {
        const entryPaths = referencedDeclarations(compiler, propertyValue(recordProperty(record, "entry")));
        const admitPaths = referencedDeclarations(compiler, propertyValue(recordProperty(record, "admit")));
        const transformerPaths = referencedDeclarations(compiler, propertyValue(recordProperty(record, "transformer")));
        const admission = join(dirname(expectedEntry.path), `admit-${basename(expectedEntry.path)}`);
        const adapterRoot = tree.path("runtime", "server", "capabilities", "adapters");
        if (!entryPaths.includes(expectedEntry.path)) {
          found.push({
            subject: "provenance",
            path,
            line: lineOf(declaration.source, recordProperty(record, "entry") ?? record.property),
            fingerprint: `${record.name}:entry`,
            message: `${record.name} entry does not resolve to ${tree.rel(expectedEntry.path)}`
          });
        }
        if (!admitPaths.includes(admission)) {
          found.push({
            subject: "provenance",
            path,
            line: lineOf(declaration.source, recordProperty(record, "admit") ?? record.property),
            fingerprint: `${record.name}:admit`,
            message: `${record.name} admission does not resolve to ${tree.rel(admission)}`
          });
        }
        if (!transformerPaths.some((target) => target.startsWith(`${adapterRoot}/`))) {
          found.push({
            subject: "provenance",
            path,
            line: lineOf(declaration.source, recordProperty(record, "transformer") ?? record.property),
            fingerprint: `${record.name}:transformer`,
            message: `${record.name} transformer does not resolve to the runtime capability adapter directory`
          });
        }
      }
    }

    const remote = remotePath(tree);
    const remoteRefs = remoteRegistryReferences(tree).map(({ name }) => name);
    const remoteExpected = records
      .filter((record) => stringValue(propertyValue(recordProperty(record, "kind"))) !== "internal")
      .map(({ name }) => name)
      .sort();
    if (!tree.isFile(remote)) {
      found.push({
        subject: "remote",
        path: remote,
        line: 1,
        fingerprint: "missing-central-remote",
        message: "generated runtime/remote/capabilities.remote.ts does not exist"
      });
    } else if (
      new Set(remoteRefs).size !== remoteRefs.length ||
      [...remoteRefs].sort().join("\0") !== remoteExpected.join("\0")
    ) {
      found.push({
        subject: "remote",
        path: remote,
        line: 1,
        fingerprint: `remote-set:${remoteRefs.join(",")}`,
        message: `remote registry references (${remoteRefs.join(", ")}) do not equal the callable registry subset (${remoteExpected.join(", ")})`
      });
    }

    return found;
  }
});
