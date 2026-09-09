import { check } from "../shared/check.mjs";
import { multiWriteEntries } from "../shared/durable-mutations.mjs";

export default check({
  id: "TXN-02",
  pillar: "atomic-invariants",
  finding: "ARCH-02",
  name: "multi-write-capability-uses-a-unit-of-work",
  says: "A capability that issues more than one durable mutation encloses the complete intent in a model transaction.",
  run(tree) {
    const found = [];
    for (const entry of multiWriteEntries(tree)) {
      if (entry.mutations.every(({ atomic }) => atomic)) continue;
      const outside = entry.mutations.filter(({ atomic }) => !atomic);
      const paths = [...new Set(outside.flatMap(({ callPath }) => callPath))];
      found.push({
        path: entry.path,
        line: outside.find(({ path }) => path === entry.path)?.line,
        fingerprint: entry.mutations.map(({ method }) => method).join(","),
        message:
          `${entry.mutations.length} reachable durable mutations include ${outside.length} outside ` +
          `one transaction/unitOfWork boundary (${paths.join(" → ")})`
      });
    }
    return found;
  }
});
