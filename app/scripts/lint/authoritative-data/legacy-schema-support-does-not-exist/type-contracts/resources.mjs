import ts from "typescript";
import { memberName, typeMember, exactTypeUnion, literalProperty, literalFields, unionArms, exactFields } from "./shared.mjs";

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

export const resourceContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/core/resource.ts") ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "ExternalFileSubkind" && !exactTypeUnion(node.type, [
    "literal:text",
    "literal:code",
    "literal:data",
    "literal:image",
    "literal:audio",
    "literal:video",
    "literal:unknown"
  ])) found.add("ExternalFileSubkind.contract");
  if (node.name.text === "ResourceKind" && !exactTypeUnion(node.type, [
    "literal:document",
    "literal:presentation",
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
    "literal:presentation->presentations",
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

export const boundToContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith(
      "/representation/data/types/core/resource-set.ts"
    ) ||
    !ts.isTypeAliasDeclaration(node) ||
    node.name.text !== "BoundTo"
  ) return;
  const arms = unionArms(node.type);
  const slot = arms.find((arm) => literalProperty(arm, "kind", "slot") !== undefined);
  const resource = arms.find((arm) => literalProperty(arm, "kind", "resource") !== undefined);
  if (
    arms.length !== 2 ||
    !exactFields(literalFields(slot), new Map([
      ["kind", { optional: false, type: '"slot"' }],
      ["templateId", { optional: false, type: 'Id<"templates">' }],
      ["slot", { optional: false, type: "string" }]
    ])) ||
    !exactFields(literalFields(resource), new Map([
      ["kind", { optional: false, type: '"resource"' }],
      ["ref", { optional: false, type: "ResourceRef" }],
      ["slot", { optional: false, type: "string" }]
    ]))
  ) found.add("BoundTo.contract");
};
