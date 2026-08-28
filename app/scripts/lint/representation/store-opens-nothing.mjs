import ts from "typescript";

import { check } from "../shared/check.mjs";

/** Reaching a file, or holding one open. Either one is a lifetime. */
const FILESYSTEM = /^node:(fs|fs\/promises|net|dgram|http|https|child_process)$/;
const HANDLES = /^(open|openSync|createReadStream|createWriteStream|watch|readFileSync|writeFileSync|mkdirSync|existsSync|readdirSync|rmSync|unlinkSync)$/;

export default check({
  name: "store-opens-nothing",
  says: "No file under store/ touches the filesystem or holds a handle. Opening a file is a lifetime, and lifetimes are the runtime's.",
  run(tree) {
    const found = [];
    for (const path of tree.under(tree.path("representation", "store"))) {
      if (!path.endsWith(".ts") || path.includes("/test/")) continue;

      for (const record of tree.imports(path)) {
        if (!FILESYSTEM.test(record.specifier)) continue;
        found.push({ path, line: record.line, message: `imports ${record.specifier}` });
      }

      tree.eachNode(path, (node) => {
        if (!ts.isCallExpression(node)) return;
        const callee = node.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : null;
        if (!name || !HANDLES.test(name)) return;
        found.push({ path, line: tree.lineOf(path, node), message: `calls ${name}(), which is a lifetime` });
      });
    }
    return found;
  }
});
