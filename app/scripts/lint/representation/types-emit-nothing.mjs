import ts from "typescript";

import { check } from "../shared/check.mjs";

/**
 * Compiled rather than read.
 *
 * A `export { X } from "./y"` re-export survives erasure even when `X` is a
 * type, because the compiler cannot tell from one file which it is — and that is
 * exactly the line that pulls a runtime value into a bundle that should not have
 * one. Source alone cannot see it; the emitted JavaScript can.
 */
const emits = (text, fileName) => {
  const output = ts.transpileModule(text, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      isolatedModules: true,
      verbatimModuleSyntax: false
    }
  }).outputText;

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && line !== "export {};");
};

export default check({
  name: "types-emit-nothing",
  says: "A file under types/ produces no runtime export — checked against compiled output, because a re-export that survives erasure is invisible in source.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("representation", "data", "types"))) {
      if (!path.endsWith(".ts")) continue;
      const left = emits(tree.read(path), path);
      if (left.length === 0) continue;
      found.push({
        path,
        message: `compiles to ${left.length} line${left.length === 1 ? "" : "s"} of JavaScript, starting: ${left[0]}`
      });
    }
    return found;
  }
});
