import { check } from "../shared/check.mjs";
import {
  assignedFields,
  bodyOfDeclaration,
  declarationNamed,
  interfaceFields,
  returnedObject,
  roots
} from "../shared/runtime.mjs";

export default check({
  name: "graph-matches-its-aggregate",
  says: "What types.ts names and what the builder returns are the same set.",
  subjects: {
    "declared-is-built": "every field types.ts names is returned by the builder",
    "built-is-declared": "and nothing else is",
    "assigned-once": "no field is written twice"
  },
  run(tree) {
    const found = [];
    for (const { environment, aggregate, builder, startPath, typesPath } of roots(tree)) {
      if (!tree.isFile(startPath) || !tree.isFile(typesPath)) continue;

      const declared = interfaceFields(tree, typesPath, aggregate);
      if (!declared) {
        found.push({
          subject: "declared-is-built",
          path: typesPath,
          message: `declares no interface ${aggregate}`
        });
        continue;
      }

      const literal = returnedObject(bodyOfDeclaration(declarationNamed(tree, startPath, builder)));
      if (!literal) {
        found.push({
          subject: "built-is-declared",
          path: startPath,
          message: `${builder} returns no object literal, so the ${environment} graph cannot be read`
        });
        continue;
      }
      const built = assignedFields(literal);

      for (const field of declared) {
        if (built.includes(field)) continue;
        found.push({ subject: "declared-is-built", path: startPath, message: `${aggregate}.${field} is never assigned` });
      }
      for (const field of built) {
        if (declared.includes(field)) continue;
        found.push({ subject: "built-is-declared", path: startPath, message: `${field} is returned but ${aggregate} does not declare it` });
      }
      for (const field of new Set(built)) {
        const count = built.filter((candidate) => candidate === field).length;
        if (count > 1) {
          found.push({ subject: "assigned-once", path: startPath, message: `${field} is assigned ${count} times` });
        }
      }
    }
    return found;
  }
});
