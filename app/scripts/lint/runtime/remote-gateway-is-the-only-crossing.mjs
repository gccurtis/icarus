import ts from "typescript";

import { check } from "../shared/check.mjs";
import { registryPath, remotePath } from "../shared/capability-registry.mjs";
import { callPath, isExported, lineOf, unwrap, visit } from "../shared/pure-contract.mjs";
import { isProductionPath } from "../shared/pure-islands.mjs";
import { procedureEntries } from "../shared/trees.mjs";

const production = (tree, path) => isProductionPath(tree.src, path);

const containsRegistryReference = (node) => {
  let found = false;
  visit(node, (child) => {
    const parts =
      ts.isPropertyAccessExpression(child) || ts.isElementAccessExpression(child)
        ? callPath(child)
        : null;
    if (parts?.[0] === "capabilityRegistry" && parts.length === 2) found = true;
  });
  return found;
};

export default check({
  name: "remote-gateway-is-the-only-crossing",
  baseline: false,
  says: "All remote and internal capability invocation crosses one authenticated, scoped, statically registered gateway.",
  subjects: {
    remote: "one generated runtime remote module owns every remote export",
    gateway: "remote exports are static gateway bindings to registry entries",
    framework: "pure/product modules do not import server remote framework authority",
    client: "product clients import only the central remote facade",
    internal: "jobs and runtime callers invoke capability entries only through the lifecycle runner",
    authority: "only the authority boundary issues scope grants"
  },
  run(tree) {
    const found = [];
    const centralRemote = remotePath(tree);
    const manifest = registryPath(tree);
    const entryPaths = new Set(procedureEntries(tree));

    for (const path of tree.files.filter((file) => file.endsWith(".remote.ts") && production(tree, file))) {
      if (path === centralRemote) continue;
      found.push({
        subject: "remote",
        path,
        line: 1,
        fingerprint: `remote:${tree.rel(path)}`,
        message: "production remote export lives outside runtime/remote/capabilities.remote.ts"
      });
    }

    if (!tree.isFile(centralRemote)) {
      found.push({
        subject: "remote",
        path: centralRemote,
        line: 1,
        fingerprint: "missing-central-remote",
        message: "the central generated remote capability module is missing"
      });
    } else {
      const source = tree.source(centralRemote);
      for (const statement of source.statements) {
        if (!isExported(statement)) continue;
        if (!ts.isVariableStatement(statement)) {
          found.push({
            subject: "gateway",
            path: centralRemote,
            line: lineOf(source, statement),
            fingerprint: `non-value-export:${statement.pos}`,
            message: "central remote module may export only static named remote values"
          });
          continue;
        }
        for (const declaration of statement.declarationList.declarations) {
          const initializer = unwrap(declaration.initializer);
          if (ts.isCallExpression(initializer) && containsRegistryReference(initializer)) continue;
          found.push({
            subject: "gateway",
            path: centralRemote,
            line: lineOf(source, declaration),
            fingerprint: `unbound:${declaration.name.getText(source)}`,
            message: `${declaration.name.getText(source)} is not produced by the gateway from one static registry entry`
          });
        }
      }
    }

    for (const path of tree.files.filter((file) => /\.(?:ts|svelte)$/.test(file) && production(tree, file))) {
      for (const edge of tree.imports(path)) {
        const target = tree.resolve(edge.specifier, path);
        if (
          edge.specifier === "$app/server" &&
          path !== centralRemote
        ) {
          found.push({
            subject: "framework",
            path,
            line: edge.line,
            fingerprint: `app-server:${edge.specifier}`,
            message: "$app/server remote authority is allowed only in the central generated remote module"
          });
        }

        const productClient =
          !path.includes("/capabilities/") &&
          !path.includes("/runtime/") &&
          !path.includes("/model/server/") &&
          !path.endsWith(".server.ts");
        if (productClient && !edge.type && target?.includes("/capabilities/")) {
          found.push({
            subject: "client",
            path,
            line: edge.line,
            fingerprint: `direct-capability:${edge.specifier}`,
            message: "product client imports a capability runtime value instead of the central remote facade"
          });
        }

        if (path !== manifest && target && entryPaths.has(target)) {
          found.push({
            subject: "internal",
            path,
            line: edge.line,
            fingerprint: `entry-import:${tree.rel(target)}`,
            message: "production code imports a capability entry outside the static registry"
          });
        }
      }

      if (!path.endsWith(".ts")) continue;
      const source = tree.source(path);
      visit(source, (node) => {
        if (!ts.isCallExpression(node)) return;
        const called = callPath(node.expression)?.at(-1);
        if (!called || !/^(?:create|issue|mint).*ScopeGrant$/.test(called)) return;
        if (path.includes("/runtime/server/authority/")) return;
        found.push({
          subject: "authority",
          path,
          line: lineOf(source, node),
          fingerprint: `scope-grant:${called}:${node.pos}`,
          message: `${called} constructs scope authority outside the dedicated runtime authority boundary`
        });
      });
    }
    return found;
  }
});
