import { check } from "../shared/check.mjs";
import { implicitDependencies } from "../shared/explicit-dependencies.mjs";

const roots = (tree) => [tree.path("app-views"), tree.path("surfaces")];

const procedureSources = (tree) =>
  roots(tree)
    .flatMap((root) => tree.under(root))
    .filter(
      (path) =>
        /\.(?:svelte\.)?ts$/.test(path) &&
        tree.rel(path).includes("/procedures/") &&
        !tree.rel(path).includes("/test/")
    );

const forbiddenImport = ({ specifier, imported }) => {
  if (specifier.startsWith("node:")) return `imports ${imported} from ${specifier} instead of receiving an interface`;
  if (specifier.startsWith("$capabilities/")) return `acquires ${imported} from ${specifier} instead of a supplied capability port`;
  if (specifier.startsWith("$runtime/")) return `acquires ${imported} from ${specifier} instead of an explicit context`;
  if (specifier.startsWith("$model/") && /^(?:clientModel|serverModel|workspaceState)$/.test(imported)) {
    return `acquires ${imported} from ${specifier} instead of receiving the owned model`;
  }
  return undefined;
};

export default check({
  id: "BEH-03",
  pillar: "procedural-transparency",
  finding: "ARCH-10",
  name: "component-procedures-are-explicit",
  says: "Component procedures receive state and effect ports explicitly; only effects/ may register Svelte synchronization.",
  subjects: {
    "implicit-dependency": "component procedures acquire no model, capability, clock, browser or process authority",
    "attached-behavior": "component procedure behavior does not read state through this"
  },
  run(tree) {
    const found = [];
    for (const path of procedureSources(tree)) {
      const effects = tree.rel(path).includes("/procedures/effects/");
      for (const issue of implicitDependencies(tree, path, {
        allowAmbient: effects ? new Set(["$effect"]) : new Set(),
        forbiddenImport
      })) {
        found.push({
          subject: issue.subject === "attached-behavior" ? "attached-behavior" : "implicit-dependency",
          path,
          line: issue.line,
          fingerprint: issue.fingerprint,
          message: issue.detail
        });
      }
    }
    return found;
  }
});
