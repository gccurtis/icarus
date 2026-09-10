import ts from "typescript";

const RETIRED_TYPE_MEMBERS = new Map([
  ["DocumentFields", new Set(["templateId"])],
  ["SlideDeckFields", new Set(["templateId"])],
  ["SpreadsheetFields", new Set(["templateId"])]
]);

const REQUIRED_TYPE_MEMBERS = new Map([
  ["TemplateHole", {
    path: "/representation/data/types/templates/template.ts",
    members: new Set(["kind"])
  }],
  ["DerivedOutputRefreshJobFields", {
    path: "/representation/data/types/semantic/derived-output.ts",
    members: new Set(["requestedVersion"])
  }],
  ["PersistedPanels", {
    path: "/model/client/storage/types.ts",
    members: new Set([
      "contextWidth",
      "contextCollapsed",
      "inspectorWidth",
      "inspectorCollapsed"
    ])
  }],
  ["PersistedWorkbench", {
    path: "/model/client/storage/types.ts",
    members: new Set(["tabs"])
  }]
]);

const memberName = (member) => {
  const name = member.name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
};

const retiredMembersIn = (node, found) => {
  const name = node.name?.text;
  const retired = RETIRED_TYPE_MEMBERS.get(name);
  if (retired === undefined) return;
  const members = ts.isInterfaceDeclaration(node)
    ? node.members
    : ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)
      ? node.type.members
      : [];
  for (const member of members) {
    const field = memberName(member);
    if (field !== undefined && retired.has(field)) found.add(`${name}.${field}`);
  }
};

const missingRequiredMembersIn = (node, found) => {
  const name = node.name?.text;
  const required = REQUIRED_TYPE_MEMBERS.get(name);
  if (
    required === undefined ||
    !node.getSourceFile().fileName.replaceAll("\\", "/").endsWith(required.path)
  ) return;
  const members = ts.isInterfaceDeclaration(node)
    ? node.members
    : ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)
      ? node.type.members
      : [];
  for (const field of required.members) {
    const member = members.find((candidate) => memberName(candidate) === field);
    if (member === undefined || member.questionToken !== undefined) found.add(`${name}.${field}?`);
  }
};

const typeMember = (node) => {
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
    return `literal:${node.literal.text}`;
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    return `reference:${node.typeName.text}`;
  }
  return `syntax:${node.kind}`;
};

const exactTypeUnion = (node, expected) => {
  const members = (ts.isUnionTypeNode(node) ? node.types : [node]).map(typeMember).sort();
  const sortedExpected = [...expected].sort();
  return members.length === sortedExpected.length &&
    members.every((member, index) => member === sortedExpected[index]);
};

const resourceRefArm = (node) => {
  if (
    ts.isTypeReferenceNode(node) &&
    ts.isIdentifier(node.typeName) &&
    node.typeName.text === "ExternalFileResourceRef"
  ) return "reference:ExternalFileResourceRef";
  if (!ts.isTypeLiteralNode(node) || node.members.length !== 2) return undefined;
  const kind = node.members.find((member) => memberName(member) === "kind");
  const id = node.members.find((member) => memberName(member) === "id");
  if (
    kind === undefined || id === undefined ||
    !ts.isPropertySignature(kind) || kind.type === undefined ||
    !ts.isPropertySignature(id) || id.type === undefined ||
    !ts.isTypeReferenceNode(id.type) || !ts.isIdentifier(id.type.typeName) ||
    id.type.typeName.text !== "Id" || id.type.typeArguments?.length !== 1
  ) return undefined;
  const table = id.type.typeArguments[0];
  if (!ts.isLiteralTypeNode(table) || !ts.isStringLiteral(table.literal)) return undefined;
  return `${typeMember(kind.type)}->${table.literal.text}`;
};

const resourceContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/core/resource.ts") ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "ExternalFileSubkind" && !exactTypeUnion(node.type, [
    "literal:text",
    "literal:data",
    "literal:image",
    "literal:audio",
    "literal:video",
    "literal:unknown"
  ])) found.add("ExternalFileSubkind.contract");
  if (node.name.text === "ResourceKind" && !exactTypeUnion(node.type, [
    "literal:document",
    "literal:slides",
    "literal:spreadsheet",
    "literal:research",
    "literal:finding",
    "literal:connection",
    "reference:ExternalFileResourceKind"
  ])) found.add("ResourceKind.contract");
  if (node.name.text === "ResourceSelectorKind" && !exactTypeUnion(node.type, [
    "reference:ResourceKind",
    "literal:externalFile"
  ])) found.add("ResourceSelectorKind.contract");
  if (
    node.name.text === "ExternalFileResourceRef" &&
    resourceRefArm(node.type) !== "reference:ExternalFileResourceKind->externalFiles"
  ) found.add("ExternalFileResourceRef.contract");
  if (node.name.text !== "ResourceRef") return;
  const arms = (ts.isUnionTypeNode(node.type) ? node.type.types : [node.type])
    .map(resourceRefArm)
    .sort();
  const expected = [
    "literal:document->documents",
    "literal:slides->slideDecks",
    "literal:spreadsheet->spreadsheets",
    "literal:research->researchThreads",
    "literal:finding->findings",
    "literal:connection->connectors",
    "reference:ExternalFileResourceRef"
  ].sort();
  if (
    arms.some((arm) => arm === undefined) ||
    arms.length !== expected.length ||
    arms.some((arm, index) => arm !== expected[index])
  ) found.add("ResourceRef.contract");
};

export const typeContractMarkersIn = (node, path, found) => {
  retiredMembersIn(node, found);
  missingRequiredMembersIn(node, found);
  resourceContractIn(node, path, found);
};
