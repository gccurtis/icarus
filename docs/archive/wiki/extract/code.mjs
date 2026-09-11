import ts from "../../app/node_modules/typescript/lib/typescript.js";

const unwrap = (node) => {
  let at = node;
  while (
    at &&
    (ts.isAsExpression(at) ||
      ts.isSatisfiesExpression?.(at) ||
      ts.isParenthesizedExpression(at) ||
      ts.isTypeAssertionExpression?.(at))
  ) {
    at = at.expression;
  }
  return at;
};

const unwrapCall = (node, names) => {
  let at = unwrap(node);
  while (
    at &&
    ts.isCallExpression(at) &&
    ts.isPropertyAccessExpression(at.expression) &&
    names.includes(at.expression.name.text) &&
    at.arguments.length === 1
  ) {
    at = unwrap(at.arguments[0]);
  }
  return at;
};

export const valueOf = (node, source) => {
  const at = unwrapCall(node, ["freeze"]);
  if (!at) return undefined;
  if (ts.isStringLiteral(at) || ts.isNoSubstitutionTemplateLiteral(at)) return at.text;
  if (ts.isNumericLiteral(at)) return Number(at.text);
  if (at.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (at.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (at.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(at) && ts.isNumericLiteral(at.operand)) {
    return at.operator === ts.SyntaxKind.MinusToken ? -Number(at.operand.text) : Number(at.operand.text);
  }
  if (ts.isArrayLiteralExpression(at)) return at.elements.map((element) => valueOf(element, source));
  if (ts.isObjectLiteralExpression(at)) {
    const result = {};
    for (const property of at.properties) {
      if (ts.isPropertyAssignment(property)) {
        const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
          ? property.name.text
          : property.name.getText(source);
        result[key] = valueOf(property.initializer, source);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        result[property.name.text] = { identifier: property.name.text };
      }
    }
    return result;
  }
  if (ts.isIdentifier(at)) return { identifier: at.text };
  if (ts.isPropertyAccessExpression(at)) return { identifier: at.getText(source) };
  if (ts.isArrowFunction(at) || ts.isFunctionExpression(at)) return { function: at.getText(source).slice(0, 200) };
  return { expression: at.getText(source).slice(0, 200) };
};

export const declarationNamed = (tree, path, wanted) => {
  const source = tree.source(path);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === wanted) {
        return { declaration, source };
      }
    }
  }
  return null;
};

export const valueNamed = (tree, path, wanted) => {
  const found = declarationNamed(tree, path, wanted);
  if (!found || !found.declaration.initializer) return undefined;
  return valueOf(found.declaration.initializer, found.source);
};

export const typeMembers = (tree, path, wanted) => {
  const source = tree.source(path);
  for (const statement of source.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === wanted) {
      return membersOf(statement.type, source);
    }
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === wanted) {
      return statement.members.map((member) => memberOf(member, source)).filter(Boolean);
    }
  }
  return null;
};

const membersOf = (type, source) => {
  if (ts.isTypeLiteralNode(type)) return type.members.map((member) => memberOf(member, source)).filter(Boolean);
  if (ts.isIntersectionTypeNode(type)) return type.types.flatMap((part) => membersOf(part, source));
  if (ts.isTypeReferenceNode(type)) return [{ name: type.getText(source), type: type.getText(source), reference: true }];
  return [];
};

const memberOf = (member, source) => {
  if (ts.isPropertySignature(member) && member.name) {
    return {
      name: member.name.getText(source),
      optional: Boolean(member.questionToken),
      type: member.type ? member.type.getText(source).replace(/\s+/g, " ") : "unknown"
    };
  }
  if (ts.isMethodSignature(member) && member.name) {
    return {
      name: member.name.getText(source),
      optional: Boolean(member.questionToken),
      type: member.getText(source).replace(/\s+/g, " "),
      method: true
    };
  }
  return null;
};

export const typeAliases = (tree, path) => {
  const source = tree.source(path);
  const found = [];
  for (const statement of source.statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isTypeAliasDeclaration(statement)) {
      found.push({
        name: statement.name.text,
        kind: "type",
        exported,
        text: statement.type.getText(source).replace(/\s+/g, " ").slice(0, 4000),
        line: source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1
      });
    } else if (ts.isInterfaceDeclaration(statement)) {
      found.push({
        name: statement.name.text,
        kind: "interface",
        exported,
        members: statement.members.map((member) => memberOf(member, source)).filter(Boolean),
        line: source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1
      });
    }
  }
  return found;
};

export const symbolsOf = (tree, path) => {
  if (!path.endsWith(".ts")) return [];
  const source = tree.source(path);
  const found = [];
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const isExported = (statement) =>
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of source.statements) {
    const exported = isExported(statement);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const initializer = declaration.initializer ? unwrap(declaration.initializer) : undefined;
        const kind =
          initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
            ? "function"
            : "const";
        found.push({ name: declaration.name.text, kind, exported, line: line(declaration) });
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      found.push({ name: statement.name.text, kind: "function", exported, line: line(statement) });
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      found.push({ name: statement.name.text, kind: "class", exported, line: line(statement) });
    } else if (ts.isTypeAliasDeclaration(statement)) {
      found.push({ name: statement.name.text, kind: "type", exported, line: line(statement) });
    } else if (ts.isInterfaceDeclaration(statement)) {
      found.push({ name: statement.name.text, kind: "interface", exported, line: line(statement) });
    } else if (ts.isEnumDeclaration(statement)) {
      found.push({ name: statement.name.text, kind: "enum", exported, line: line(statement) });
    } else if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        found.push({
          name: element.name.text,
          kind: statement.isTypeOnly || element.isTypeOnly ? "type" : "re-export",
          exported: true,
          from: statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined,
          line: line(element)
        });
      }
    }
  }
  return found;
};

export const constructionsIn = (tree, path, builderName) => {
  const found = declarationNamed(tree, path, builderName);
  if (!found) return [];
  const { declaration, source } = found;
  const initializer = declaration.initializer ? unwrap(declaration.initializer) : undefined;
  if (!initializer || !(ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) return [];
  const body = initializer.body;
  const built = [];
  const record = (name, call) => {
    let at = call && ts.isAwaitExpression(call) ? call.expression : call;
    if (!at || !ts.isCallExpression(at) || !ts.isIdentifier(at.expression)) return;
    if (!/^create[A-Z]/.test(at.expression.text)) return;
    const takes = [];
    for (const argument of at.arguments) {
      const step = (node) => {
        if (ts.isIdentifier(node)) takes.push(node.text);
        node.forEachChild(step);
      };
      step(argument);
    }
    built.push({ name, callee: at.expression.text, takes, line: source.getLineAndCharacterOfPosition(at.getStart(source)).line + 1 });
  };
  if (ts.isBlock(body)) {
    for (const statement of body.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) record(declaration.name.text, declaration.initializer);
      }
    }
    const step = (node) => {
      if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
        for (const property of node.expression.properties) {
          if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
            record(property.name.text, property.initializer);
          }
        }
      }
      node.forEachChild(step);
    };
    step(body);
  }
  return built;
};

export const returnedFields = (tree, path, builderName) => {
  const found = declarationNamed(tree, path, builderName);
  if (!found) return [];
  const { declaration } = found;
  const initializer = declaration.initializer ? unwrap(declaration.initializer) : undefined;
  if (!initializer || !(ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) return [];
  let fields = [];
  const step = (node) => {
    if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
      fields = node.expression.properties
        .map((property) => property.name)
        .filter(Boolean)
        .map((name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null))
        .filter(Boolean);
    }
    node.forEachChild(step);
  };
  step(initializer.body);
  return fields;
};

const clean = (comment) =>
  comment
    .replace(/^\/\*\*?/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, "").replace(/^\s*\*$/, ""))
    .join("\n")
    .trim();

export const headerComment = (text) => {
  const trimmed = text.replace(/^#!.*\n/, "").trimStart();
  const block = trimmed.match(/^\/\*\*?([\s\S]*?)\*\//);
  if (block) return clean(block[0]);
  const html = trimmed.match(/^<!--([\s\S]*?)-->/);
  if (html) return html[1].trim();
  return "";
};

export const firstComment = (text, isSvelte) => {
  let body = text;
  if (isSvelte) {
    const script = text.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    body = script ? script[1] : text;
    const block = body.match(/\/\*\*([\s\S]*?)\*\//);
    if (block) return clean(block[0]);
    const html = text.match(/<!--([\s\S]*?)-->/);
    return html ? html[1].trim() : "";
  }
  const header = headerComment(body);
  if (header) return header;
  const block = body.match(/\/\*\*([\s\S]*?)\*\//);
  return block ? clean(block[0]) : "";
};

export const usageLines = (comment) =>
  comment
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^pnpm /.test(line));

export const paragraphs = (comment) =>
  comment
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph && !/^pnpm /.test(paragraph));

export const testNames = (text) => {
  const found = [];
  const pattern = /^\s*(describe|test|it)(?:\.(?:fails|skip|only|todo))?\(\s*(["'`])((?:\\.|(?!\2).)*)\2/gm;
  for (const match of text.matchAll(pattern)) {
    found.push({ kind: match[1], name: match[3], template: match[2] === "`" });
  }
  return found;
};

export const headingsOf = (text) =>
  text
    .split("\n")
    .filter((line) => /^#{1,6} /.test(line))
    .map((line) => {
      const match = line.match(/^(#+) (.*)$/);
      return { depth: match[1].length, text: match[2].trim() };
    });
