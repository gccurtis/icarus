#!/usr/bin/env node
/**
 * Scaffolds one model object onto the directory template and joins it to its
 * environment root.
 *
 * usage: pnpm new-model-object -- client <name> --definition <reactive|plain> [--depends <object,object>]
 *        pnpm new-model-object -- server <name> --construction <sync|async> [--depends <object,object>]
 *
 *   <name>          kebab-case, as the directory is named
 *   --definition    reactive writes definition.svelte.ts; plain writes definition.ts
 *   --construction  async makes create<Object>() return a promise the root awaits
 *   --depends       objects in the same environment, already on the template
 *
 * Six files are written and three are edited. The three are what makes the object
 * exist rather than merely be present: an object with no aggregate field is
 * unreachable, because consumers receive the aggregate and select from it, and an
 * object the root never constructs is a field the type promises and nothing keeps.
 * `graph` reports both, so a generator that wrote only the directory would be one
 * whose output fails lint the moment it lands.
 *
 * It invents no public methods. A method is designed from its signature and its
 * behavior, and the simple-file or complex-directory choice is made when each one
 * is added — so `types.ts` arrives empty and `methods/` holds its inventory and
 * nothing else.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import {
  AGGREGATES,
  BUILDERS,
  DOCUMENTS,
  DOORS,
  ENVIRONMENTS,
  KEBAB,
  ROOT_CONSTRUCTORS,
  aggregateMembers,
  applyEdits,
  at,
  builderOf,
  camel,
  cycleFrom,
  dependencyGraph,
  doorSpecifier,
  fail,
  importEdit,
  indentAt,
  modelAliases,
  modelRoot,
  newLintFailures,
  objectNames,
  parseModule,
  pascal,
  planner,
  propertiesOf,
  render,
  returnedLiteral,
  sourceRoot,
  stopIfFailed,
  title
} from "./shared.mjs";

const USAGE = `usage: pnpm new-model-object -- client <name> --definition <reactive|plain> [--depends <object,object>]
       pnpm new-model-object -- server <name> --construction <sync|async> [--depends <object,object>]

  <name>          kebab-case, as the directory is named
  --definition    reactive writes definition.svelte.ts; plain writes definition.ts
  --construction  async makes create<Object>() return a promise the root awaits
  --depends       objects in the same environment, already on the template`;

// -------------------------------------------------------------- arguments ----

/**
 * A leading `--` is dropped rather than parsed.
 *
 * The standard documents this as `pnpm new-model-object -- client <name>`, and
 * pnpm forwards that separator to the script instead of consuming it. Treating
 * it as an argument makes the one invocation anybody will copy fail on its first
 * word.
 */
const argv = process.argv.slice(2).filter((argument, index) => !(index === 0 && argument === "--"));
const options = new Map();
const positional = [];

for (let index = 0; index < argv.length; index += 1) {
  const argument = argv[index];
  if (!argument.startsWith("--")) {
    positional.push(argument);
    continue;
  }
  const split = argument.indexOf("=");
  if (split === -1) {
    index += 1;
    options.set(argument, argv[index]);
  } else {
    options.set(argument.slice(0, split), argument.slice(split + 1));
  }
}

const [environment, name] = positional;
if (!environment || !name) {
  console.error(USAGE);
  process.exit(1);
}

for (const flag of options.keys()) {
  if (!["--definition", "--construction", "--depends"].includes(flag)) {
    fail(flag, `unknown flag\n\n${USAGE}`);
  }
}

if (!ENVIRONMENTS.includes(environment)) {
  fail(environment, `an object lives in 'client' or 'server'\n\n${USAGE}`);
}
if (!KEBAB.test(name)) {
  fail(name, "an object directory is kebab-case, e.g. browser-storage");
}
if (["test", "docs"].includes(name)) {
  fail(name, `'${name}' is an environment root's own directory, not an object`);
}

/**
 * The extension follows the contents, never the environment.
 *
 * Runes do not compile in a plain `.ts`, and `.svelte.ts` on a definition holding
 * none claims a cost the object does not pay. A client object owning no reactive
 * state is legitimate — `storage` is one — so the flag is a statement about what
 * this object will hold, and `layout` checks it against the runes that end up
 * there.
 */
const definitionKind = options.get("--definition");
const constructionKind = options.get("--construction");

if (environment === "client") {
  if (!["reactive", "plain"].includes(definitionKind)) {
    fail(
      "--definition",
      `a client object declares whether it owns reactive state: reactive or plain\n\n${USAGE}`
    );
  }
  if (constructionKind !== undefined) {
    fail(
      "--construction",
      "a client object is built synchronously — the layout that owns the instance cannot await one"
    );
  }
} else if (environment === "server") {
  if (!["sync", "async"].includes(constructionKind)) {
    fail(
      "--construction",
      `a server object declares whether acquiring its resource awaits: sync or async\n\n${USAGE}`
    );
  }
  if (definitionKind !== undefined) {
    fail(
      "--definition",
      "a server object holds no reactive state — runes and '.svelte.ts' are client-side"
    );
  }
}

const reactive = definitionKind === "reactive";
const asynchronous = constructionKind === "async";
const dependencyNames = (options.get("--depends") ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

stopIfFailed("new-model-object");

const aliases = await modelAliases();
stopIfFailed("new-model-object");

// ------------------------------------------------------------ environment ----

const environmentRoot = join(modelRoot, environment);
const typesPath = join(environmentRoot, "types.ts");
const constructorPath = join(environmentRoot, ROOT_CONSTRUCTORS[environment]);
const documentPath = join(environmentRoot, DOCUMENTS[environment]);

for (const required of [typesPath, constructorPath, documentPath]) {
  if (!existsSync(required)) {
    fail(
      at(required),
      "missing — an object joins an environment root that is already here, and this generator does not create one"
    );
  }
}
stopIfFailed("new-model-object");

const typesText = readFileSync(typesPath, "utf8");
const typesFile = parseModule(typesPath, typesText);
const aggregate = aggregateMembers(typesFile, AGGREGATES[environment]);

if (!aggregate) {
  fail(
    at(typesPath),
    `no '${AGGREGATES[environment]}' declared — the aggregate is the contract this object joins`
  );
}
stopIfFailed("new-model-object");

const declaredTypes = new Map(
  aggregate.members
    .filter((member) => member.name)
    .map((member) => [member.name.getText(typesFile), member.type?.getText(typesFile) ?? null])
);

// ------------------------------------------------------------ the object ----

const objectRoot = join(environmentRoot, name);
const object = `${environment}/${name}`;
const existing = objectNames(environment);

if (existsSync(objectRoot)) {
  fail(at(objectRoot), "already exists — nothing was written");
}

const Type = `${pascal(name)}Model`;
const Class = pascal(name);
const constructorName = `create${pascal(name)}`;
const field = camel(name);

/** Each dependency as the root already knows it: its field, its type, and its door. */
const dependencies = [];
for (const dependency of dependencyNames) {
  if (dependency === name) {
    fail(name, "would depend on itself — a constructor cannot receive what it is building");
    continue;
  }
  if (dependencies.some((entry) => entry.name === dependency)) {
    fail(dependency, "named twice in --depends");
    continue;
  }
  if (!existing.includes(dependency)) {
    const known = objectNames(environment === "client" ? "server" : "client").includes(dependency);
    fail(
      dependency,
      known
        ? `is a ${environment === "client" ? "server" : "client"} object — the two trees never import one another`
        : `no such object in model/${environment}/ — there is ${existing.length > 0 ? existing.join(", ") : "nothing here yet"}`
    );
    continue;
  }
  const dependencyField = camel(dependency);
  const dependencyType = declaredTypes.get(dependencyField);
  if (!dependencyType) {
    fail(
      at(typesPath),
      `'${AGGREGATES[environment]}' has no field '${dependencyField}' to depend on — the aggregate is what the root hands out`
    );
    continue;
  }
  dependencies.push({
    name: dependency,
    field: dependencyField,
    type: dependencyType,
    door: doorSpecifier(environment, dependency)
  });
}
stopIfFailed("new-model-object");

/**
 * A cycle is checked against the graph this object would join, not against the
 * one on disk.
 *
 * Nothing imports a new object yet, so the only cycle it can close itself is a
 * self-dependency — but the tree it joins can already hold one, and generating
 * into it would produce a scaffold that cannot be constructed in any order. The
 * reading is `graph`'s, so the refusal here is the failure that would have
 * arrived a moment later.
 */
const scope = { model: modelRoot, source: sourceRoot, base: modelRoot, aliases };
const graph = dependencyGraph(scope);
graph.set(object, new Set(dependencies.map((entry) => `${environment}/${entry.name}`)));

for (const start of graph.keys()) {
  const cycle = cycleFrom(graph, start);
  if (cycle) {
    fail(
      at(join(modelRoot, cycle[0])),
      `dependency cycle: ${cycle.join(" → ")} — an object graph has a construction order or it has neither`
    );
    break;
  }
}
stopIfFailed("new-model-object");

// ----------------------------------------------------------------- files ----

const definitionFile = reactive ? "definition.svelte.ts" : "definition.ts";
const definitionSpecifier = `$model/${environment}/${name}/${reactive ? "definition.svelte" : "definition"}`;
const write = planner();

const parameters = dependencies.map((entry) => `${entry.field}: ${entry.type}`).join(", ");

write.add(
  join(objectRoot, `${name}.md`),
  render("object.md", {
    "Object Name": title(name),
    "object-name": name,
    ObjectType: Type,
    objectName: field,
    constructorName,
    dependencies: parameters,
    dependencyName: dependencies.map((entry) => entry.field),
    "BORROWED / OWNED": "BORROWED",
    "one per browser JavaScript realm / one per server process":
      environment === "client" ? "one per client instance" : "one per server process",
    "the environment root's composition function, named here": `\`${BUILDERS[environment]}\`, in \`${ROOT_CONSTRUCTORS[environment]}\``
  })
);

write.add(
  join(objectRoot, "types.ts"),
  `/**
 * The surface ${title(name)} offers, and the values that cross it.
 *
 * A consumer depends on this and on nothing else in the directory. Past the door
 * are a definition, its state, and its methods — none of which this object
 * promised to keep stable.
 *
 * TODO: declare the readonly state and the methods. No field here may name a
 * Svelte \`Component\` or a registry of them: the model exposes stable keys and the
 * view layer resolves them, which is what keeps this object testable without a
 * DOM.
 */
export interface ${Type} {
  // TODO: the public surface. Nothing was invented here — a method is designed
  // from its signature and its behavior, and whether it is one file or a
  // directory is decided when it is added.
}
`
);

/**
 * The definition's placeholder state.
 *
 * A reactive definition has to declare a rune or it is lying about its extension,
 * and `layout` reads the two against each other in both directions. The plain
 * shape is the same field without one, so an object that turns out to be reactive
 * changes a line and a filename rather than a structure.
 */
const placeholderState = reactive
  ? `  /**
   * TODO: replace this with the reactive state this object owns.
   *
   * The rune is what makes this module \`.svelte.ts\`. If ${title(name)} turns out
   * to own no reactive state, delete this field and rename the file
   * \`definition.ts\` — the extension follows the runes, never the environment.
   */
  #todo = $state<unknown>(undefined);`
  : `  /** TODO: replace this with the state or resource this object owns. */
  #todo: unknown;`;

/** Imports sorted by what they name, which is the order the rest of the tree keeps them in. */
const importBlock = (lines) =>
  [...lines]
    .sort((a, b) => (a.slice(a.indexOf('"')) < b.slice(b.indexOf('"')) ? -1 : 1))
    .join("\n");

/**
 * A parameter list is wrapped only when it is long, which is how the objects
 * already on the template read: two short dependencies stay on the line, and the
 * pair that does not fit becomes one per line rather than a wrap nobody chose.
 */
const parameterList = (parameters, head, tail, indent = "") => {
  const inline = `${head}(${parameters.join(", ")})${tail}`;
  if (inline.length <= 96) return inline;
  return `${head}(\n${indent}  ${parameters.join(`,\n${indent}  `)}\n${indent})${tail}`;
};

const definitionImports = importBlock([
  ...dependencies.map((entry) => `import type { ${entry.type} } from "${entry.door}";`),
  `import type { ${Type} } from "$model/${environment}/${name}/types";`
]);

write.add(
  join(objectRoot, definitionFile),
  `${definitionImports}

/**
 * The state ${title(name)} holds for the life of ${environment === "client" ? "one client instance" : "one server process"}.
 *
 * State lives on the instance. A module is imported once per process — on the
 * server whether or not SSR is on — so a module-level value would be one value
 * shared by every instance of this object and by every request that reaches it.
 *
 * Public calls delegate to \`methods/\`, which is what keeps this file readable as
 * the surface instead of accumulating the implementation behind it.
 */
export class ${Class} implements ${Type} {
${placeholderState}
${
  dependencies.length > 0
    ? `
${parameterList(
  dependencies.map((entry) => `private readonly ${entry.field}: ${entry.type}`),
  "  constructor",
  " {}",
  "  "
)}
`
    : ""
}}
`
);

const constructorImports = importBlock([
  ...dependencies.map((entry) => `import type { ${entry.type} } from "${entry.door}";`),
  `import { ${Class} } from "${definitionSpecifier}";`,
  `import type { ${Type} } from "$model/${environment}/${name}/types";`
]);

const construction = `new ${Class}(${dependencies.map((entry) => entry.field).join(", ")})`;
const signature = parameterList(
  dependencies.map((entry) => `${entry.field}: ${entry.type}`),
  `export const ${constructorName} = ${asynchronous ? "async " : ""}`,
  asynchronous ? `: Promise<${Type}>` : `: ${Type}`
);

const constructorBody = asynchronous
  ? `${signature} => {
  // TODO: acquire what ${title(name)} needs before handing back a usable object —
  // a file read, a connection, a handshake. Async construction exists for exactly
  // that, and an object that acquires nothing is built synchronously instead.
  return ${construction};
}`
  : `${signature} => ${construction}`;

write.add(
  join(objectRoot, "constructor.ts"),
  `${constructorImports}

/**
 * Returns a fresh ${title(name)}.
 *
 * Every call returns a new object, and nothing here caches one: \`${BUILDERS[environment]}\`
 * calls this once and the environment root holds what it gets. That is what keeps
 * one ${environment === "client" ? "client instance" : "process"} to one graph — and what lets a test build two and prove
 * they share nothing.
 *
 * ${
   dependencies.length > 0
     ? "Dependencies are BORROWED: the root constructed them and the root releases\n * them, so this object must never close one."
     : "This object depends on nothing, so it is constructed first in whatever order\n * the root settles on."
 }
 */
${constructorBody};
`
);

write.add(
  join(objectRoot, DOORS[environment]),
  `/**
 * The door for ${title(name)}.
 *
 * The composition root takes the constructor; every other object takes the type.
 * Nothing outside this directory reaches past this file, because a definition, a
 * method, and a private type are all things ${title(name)} may change without
 * telling anyone.
 */
export { ${constructorName} } from "$model/${environment}/${name}/constructor";
export type { ${Type} } from "$model/${environment}/${name}/types";
`
);

write.add(
  join(objectRoot, "methods", "methods.md"),
  render("methods.md", { "Object Name": title(name), ObjectType: Type })
);

// ------------------------------------------------- joining the aggregate ----

/**
 * Where a new field goes: after the last one that is an object.
 *
 * Appending to the end would satisfy the ordering rule — everything this object
 * depends on is already above it — but it would also put an object after the
 * aggregate's terminal operation, and `close` reads as the end of the list because
 * it is. The same anchor is used in the type and in the builder, so the two stay
 * in the same order.
 */
const lastObjectField = (names) => {
  const fields = new Set(existing.map((entry) => camel(entry)));
  for (let index = names.length - 1; index >= 0; index -= 1) {
    if (fields.has(names[index])) return index;
  }
  return names.length - 1;
};

write.edit(typesPath, (text) => {
  const file = parseModule(typesPath, text);
  const { container, members } = aggregateMembers(file, AGGREGATES[environment]);
  const edits = [
    importEdit(file, text, `import type { ${Type} } from "${doorSpecifier(environment, name)}";`, doorSpecifier(environment, name))
  ].filter(Boolean);

  const names = members.map((member) => (member.name ? member.name.getText(file) : ""));
  const anchor = members[lastObjectField(names)];
  const offset = anchor ? anchor.getEnd() : container.getEnd() - 1;
  const indent = anchor ? indentAt(text, anchor.getStart(file)) : "  ";
  edits.push({ start: offset, end: offset, text: `\n${indent}readonly ${field}: ${Type};` });

  return applyEdits(text, edits);
});

const constructorText = readFileSync(constructorPath, "utf8");
const constructorFile = parseModule(constructorPath, constructorText);
const builder = builderOf(constructorFile, BUILDERS[environment]);
const returned = builder ? returnedLiteral(builder) : null;

if (!returned) {
  fail(
    at(constructorPath),
    `'${BUILDERS[environment]}' returns no object literal — the graph has to be readable as a list of fields before one can be added to it`
  );
}
if (asynchronous && builder && !builder.asynchronous) {
  fail(
    at(constructorPath),
    `'${BUILDERS[environment]}' is not async, so nothing here can await a constructor — make it 'async' and return Promise<${AGGREGATES[environment]}> first`
  );
}
stopIfFailed("new-model-object");

/**
 * What to pass a dependency, named as it already is inside the builder.
 *
 * The aggregate field is not always a binding: `storage: store` names one and
 * `workbench: createWorkbench(store)` names none. The first two shapes are read;
 * the third is hoisted into a `const` immediately above the return, where every
 * name it uses is already in scope, and the field becomes shorthand. Passing the
 * field name blind would compile against whatever else happened to be in scope.
 */
const argumentEdits = [];
const argumentFor = (dependency) => {
  const property = propertiesOf(returned.literal, constructorFile).find(
    (entry) => entry.name === dependency.field
  );
  if (!property) {
    fail(
      at(constructorPath),
      `'${BUILDERS[environment]}' assigns no '${dependency.field}' — this object cannot depend on something the root does not build`
    );
    return dependency.field;
  }

  const node = property.node;
  if (ts.isShorthandPropertyAssignment(node)) return dependency.field;
  if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.initializer)) {
    return node.initializer.text;
  }
  if (!returned.returnStatement) {
    fail(
      at(constructorPath),
      `'${dependency.field}' is built inside the returned literal, and there is no statement to name it in — give '${BUILDERS[environment]}' a block body and run this again`
    );
    return dependency.field;
  }

  const start = returned.returnStatement.getStart(constructorFile);
  const indent = indentAt(constructorText, start);
  argumentEdits.push({
    start,
    end: start,
    text: `const ${dependency.field} = ${node.initializer.getText(constructorFile)};\n\n${indent}`
  });
  argumentEdits.push({
    start: node.getStart(constructorFile),
    end: node.getEnd(),
    text: dependency.field
  });
  return dependency.field;
};

const args = dependencies.map(argumentFor);
stopIfFailed("new-model-object");

write.edit(constructorPath, (text) => {
  const door = doorSpecifier(environment, name);
  const edits = [
    importEdit(constructorFile, text, `import { ${constructorName} } from "${door}";`, door),
    ...argumentEdits
  ].filter(Boolean);

  const properties = propertiesOf(returned.literal, constructorFile);
  const anchor = properties[lastObjectField(properties.map((entry) => entry.name))];
  const call = `${asynchronous ? "await " : ""}${constructorName}(${args.join(", ")})`;

  if (anchor) {
    const offset = anchor.node.getEnd();
    const indent = indentAt(text, anchor.node.getStart(constructorFile));
    edits.push({ start: offset, end: offset, text: `,\n${indent}${field}: ${call}` });
  } else {
    const offset = returned.literal.getStart(constructorFile) + 1;
    edits.push({ start: offset, end: offset, text: `\n    ${field}: ${call}\n  ` });
  }

  return applyEdits(text, edits);
});

// --------------------------------------------- joining the root document ----

/**
 * The environment document opens with a table of the objects in it, and that
 * table is the generated inventory: a reviewer reads it before the tree, and an
 * object missing from it is one nobody knows to look for.
 */
write.edit(documentPath, (text) => {
  const lines = text.split("\n");
  const header = lines.findIndex((line) => /^\|\s*Object\s*\|/.test(line));
  if (header === -1) {
    fail(
      at(documentPath),
      "no object inventory — add a table whose first column is 'Object', so a generated object has somewhere to be listed"
    );
    return text;
  }

  let last = header + 1;
  while (last + 1 < lines.length && lines[last + 1].startsWith("|")) last += 1;

  const columns = lines[header]
    .split("|")
    .slice(1, -1)
    .map((column) => column.trim());

  const cells = columns.map((column, index) => {
    if (index === 0) return `[\`${name}\`](${name}/${name}.md)`;
    if (column.includes("$state")) return reactive ? "yes" : "no";
    if (/^owns$/i.test(column)) return "TODO: the state or resource it owns";
    return `TODO: ${column.toLowerCase()}`;
  });

  lines.splice(last + 1, 0, `| ${cells.join(" | ")} |`);
  return lines.join("\n");
});
stopIfFailed("new-model-object");

// ------------------------------------------------------------------ lint ----

/**
 * The plan is linted before a byte of it is written.
 *
 * This is the step that makes the rest trustworthy: the generator's claim is that
 * what it writes already passes `pnpm lint:model`, and the only way to know is to
 * run the real rules over the real result. Everything above is a decision about
 * shape, and this is the check that the decisions were right.
 */
const failures = newLintFailures(write.files(), aliases);
if (failures.length > 0) {
  console.error(
    `new-model-object: the planned object fails model lint, so nothing was written\n`
  );
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("\nSee docs/model-directory/model-directory.md.");
  process.exit(1);
}

const written = write.commit();

console.log(`new-model-object: wrote ${written.created.length} files, edited ${written.edited.length}\n`);
for (const path of written.created) console.log(`  ${path}`);
for (const path of written.edited) console.log(`  ${path}  (edited)`);

console.log(`
Three things this cannot do for you:

  1. Design the public surface. ${at(join(objectRoot, "types.ts"))} is empty
     because a method is designed from its signature and its behavior, and the
     file-or-directory choice belongs to the moment it is added.
  2. Fill the TODOs — one grep over ${at(objectRoot)} finds every decision the
     documents are still waiting on.
  3. Write the tests: unit/ mirrors the methods, regression/ holds one fixed
     defect per file, non-functional/ covers ${reactive ? "reactivity, " : ""}concurrency and cleanup.

Then:  pnpm lint:model`);
