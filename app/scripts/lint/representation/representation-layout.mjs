import { check } from "../shared/check.mjs";

/**
 * Three places, so no file can be ambiguous about which rules apply to it.
 * A fourth would need its own answer to "does this emit anything" and "is this
 * pure", and every check here would have to grow a branch for it.
 */
const PLACES = [
  ["data", "types"],
  ["data", "behavior"],
  ["store"]
];

export default check({
  name: "representation-layout",
  says: "Every file is under data/types/, data/behavior/ or store/. There is no fourth place.",
  run(tree) {
    const root = tree.path("representation");
    const homes = PLACES.map((segments) => tree.path("representation", ...segments));
    const found = [];

    for (const path of tree.under(root)) {
      if (path.endsWith(".md")) continue;
      if (homes.some((home) => tree.within(home, path))) continue;
      found.push({
        path,
        message: `sits outside ${PLACES.map((segments) => segments.join("/") + "/").join(", ")}`
      });
    }
    return found;
  }
});
