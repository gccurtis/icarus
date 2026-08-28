import { check } from "../shared/check.mjs";
import { homes } from "../shared/home.mjs";

export default check({
  name: "module-has-one-home",
  says: "A module belongs to one process and says which by where it sits.",
  subjects: {
    "by-filename": "a framework suffix decides first, because the toolchain already enforces it",
    "by-tree": "otherwise the directory decides",
    "unresolved-is-a-failure": "a module neither rule reaches has no stated home"
  },
  run(tree) {
    const found = [];
    for (const [path, { home }] of homes(tree)) {
      if (home) continue;
      found.push({
        subject: "unresolved-is-a-failure",
        path,
        message: "no rule gives this module a process; every boundary check assumes one"
      });
    }
    return found;
  }
});
