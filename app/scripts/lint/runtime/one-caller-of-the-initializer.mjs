import { check } from "../shared/check.mjs";
import { roots } from "../shared/runtime.mjs";

/** Where the one call belongs: the layout that owns a tab, and the hook that owns a process. */
const CALLERS = {
  client: /^src\/routes\/app\/\[project\]\/\+layout\.svelte$/,
  server: /^src\/hooks\.server\.ts$/
};

export default check({
  name: "one-caller-of-the-initializer",
  says: "Exactly one module calls init<Env>Model, and it is the layout or the hook. Two callers is two graphs, one of which is unreachable.",
  run(tree) {
    const found = [];

    for (const { environment, initializer, startPath } of roots(tree)) {
      const callers = [];
      for (const path of tree.files) {
        if (!/\.(ts|js|svelte)$/.test(path)) continue;
        if (path === startPath || path.includes("/test/")) continue;
        const takesIt = tree.imports(path).some((record) => record.names.includes(initializer));
        if (takesIt && tree.read(path).includes(`${initializer}(`)) callers.push(path);
      }

      if (callers.length === 0) {
        found.push({ path: startPath, message: `nothing calls ${initializer}, so no ${environment} graph is ever built` });
        continue;
      }
      for (const caller of callers) {
        if (CALLERS[environment].test(tree.rel(caller))) continue;
        found.push({ path: caller, message: `calls ${initializer}, which belongs to one module` });
      }
      if (callers.length > 1) {
        found.push({
          path: startPath,
          message: `${initializer} is called from ${callers.length} modules: ${callers.map((path) => tree.rel(path)).join(", ")}`
        });
      }
    }
    return found;
  }
});
