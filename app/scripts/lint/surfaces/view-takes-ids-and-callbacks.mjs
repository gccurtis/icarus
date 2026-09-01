import ts from "typescript";
import { parse as parseSvelte } from "svelte/compiler";

import { check } from "../shared/check.mjs";
import { VIEW_TREES } from "../shared/trees.mjs";

/**
 * The script block, as TypeScript.
 *
 * `svelte/compiler` knows where the script is and TypeScript knows what is in
 * it; neither alone reads a typed `$props()` destructure. The offset is kept so
 * a finding names the line in the component rather than in the extracted block.
 */
const scriptOf = (tree, path) => {
  const text = tree.read(path);
  let block;
  try {
    const ast = parseSvelte(text, { modern: true });
    block = ast.instance ?? ast.module;
  } catch {
    return null;
  }
  if (!block) return null;

  const { start, end } = block.content;
  return {
    file: ts.createSourceFile(path, text.slice(start, end), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    lineOf: (node) => text.slice(0, start + node.getStart()).split("\n").length
  };
};

/**
 * What a named type turns out to be, followed through the module that declares
 * it. `PersonId` is a branded string and `Side` is a union of two literals —
 * both are ids, and both are invisible without the hop. Two hops is enough for
 * every alias in this tree, and the depth limit is what stops a cycle.
 */
const HOPS = 2;

const resolveAlias = (tree, script, path, name, depth) => {
  if (depth > HOPS) return null;
  const record = tree.imports(path).find((candidate) => candidate.names.includes(name));
  if (!record) return null;
  const module = tree.resolve(record.specifier, path);
  if (!module || !module.endsWith(".ts")) return null;

  for (const statement of tree.source(module).statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return { type: statement.type, file: tree.source(module), path: module };
    }
  }
  return null;
};

/** A prop the component may take: something it can be told, or something it can call. */
const isIdentifierOrCallback = (type, context, depth = 0) => {
  if (!type) return false;

  switch (type.kind) {
    case ts.SyntaxKind.StringKeyword:
    case ts.SyntaxKind.NumberKeyword:
    case ts.SyntaxKind.BooleanKeyword:
    case ts.SyntaxKind.LiteralType:
    case ts.SyntaxKind.UndefinedKeyword:
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.VoidKeyword:
    case ts.SyntaxKind.FunctionType:
      return true;
    default:
      break;
  }
  if (ts.isUnionTypeNode(type)) return type.types.every((member) => isIdentifierOrCallback(member, context, depth));
  if (ts.isParenthesizedTypeNode(type)) return isIdentifierOrCallback(type.type, context, depth);
  // A brand is an intersection of a primitive and a marker; what carries the
  // value is the primitive half.
  if (ts.isIntersectionTypeNode(type)) {
    return type.types.some((member) => isIdentifierOrCallback(member, context, depth));
  }

  if (!ts.isTypeReferenceNode(type)) return false;
  const name = type.typeName.getText();
  // `Snippet` is markup the parent owns, which is the one thing a parent is
  // allowed to hand down — it is not this surface's content to disagree about.
  if (name.endsWith("Snippet")) return true;

  const followed = resolveAlias(context.tree, context.script, context.path, name, depth + 1);
  if (!followed) return false;
  return isIdentifierOrCallback(followed.type, { ...context, path: followed.path }, depth + 1);
};

/** Props declared on the `$props()` destructure, with the type each was given. */
const declaredProps = (script) => {
  for (const statement of script.file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer || !ts.isCallExpression(initializer)) continue;
      if (initializer.expression.getText(script.file) !== "$props") continue;

      const annotation = declaration.type;
      if (!annotation || !ts.isTypeLiteralNode(annotation)) return [];
      return annotation.members
        .filter((member) => ts.isPropertySignature(member) && member.name)
        .map((member) => ({
          name: member.name.getText(script.file),
          type: member.type,
          node: member
        }));
    }
  }
  return null;
};

export default check({
  name: "view-takes-ids-and-callbacks",
  says: "A prop is a callback or an id, never the thing being displayed. Content arriving as a prop is content two surfaces can disagree about.",
  run(tree) {
    const found = [];
    for (const path of VIEW_TREES.flatMap((name) => tree.under(tree.path(name)))) {
      if (!path.endsWith(".svelte")) continue;
      if (tree.within(tree.path("development-views"), path)) continue;

      const script = scriptOf(tree, path);
      if (!script) continue;

      const context = { tree, script, path };
      for (const { name, type, node } of declaredProps(script) ?? []) {
        if (name === "children" || isIdentifierOrCallback(type, context)) continue;
        found.push({
          path,
          line: script.lineOf(node),
          message: `takes ${name}: ${type ? type.getText(script.file) : "an untyped value"} rather than reading it from a capability`
        });
      }
    }
    return found;
  }
});
