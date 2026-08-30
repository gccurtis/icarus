import { check } from "../shared/check.mjs";
import { CLIENT, SERVER, TEST, homes } from "../shared/home.mjs";

/** `capabilities/<capability>/index.ts` and nothing below it. */
const isCapabilityIndex = (tree, path) => {
  const segments = tree.rel(path).split("/");
  return segments[2] === "capabilities" && segments.length === 5 && segments[4].startsWith("index.");
};

export default check({
  name: "one-crossing",
  says: "The only client→server edge in the repository is a capability index. One crossing can be audited; five cannot.",
  run(tree) {
    const where = homes(tree);
    const found = [];

    for (const [path, { home }] of where) {
      if (home !== CLIENT || home === TEST) continue;
      for (const record of tree.imports(path)) {
        if (record.type) continue;
        const to = tree.resolve(record.specifier, path);
        if (!to) continue;
        if (where.get(to)?.home !== SERVER) continue;
        if (isCapabilityIndex(tree, to)) continue;
        found.push({
          path,
          line: record.line,
          message: `crosses to the server at ${tree.rel(to)}, which is not a capability index`
        });
      }
    }
    return found;
  }
});
