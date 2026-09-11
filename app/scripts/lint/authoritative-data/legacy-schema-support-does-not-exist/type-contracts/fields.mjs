import ts from "typescript";
import { memberName, typeMember } from "./shared.mjs";

const RETIRED_TYPE_MEMBERS = new Map([
  ["DocumentFields", new Set(["templateId"])],
  ["DerivedVariableDefinition", new Set(["origin"])],
  ["PresentationFields", new Set(["templateId"])],
  ["SpreadsheetFields", new Set(["templateId"])]
]);

const REQUIRED_TYPE_MEMBERS = new Map([
  ["Message", {
    path: "/representation/data/types/agents/message.ts",
    members: new Set(["author"])
  }],
  ["TemplateHole", {
    path: "/representation/data/types/templates/template.ts",
    members: new Set(["kind"])
  }],
  ["SemanticTextCitation", {
    path: "/representation/data/types/semantic/derived-output.ts",
    members: new Set(["evidenceKind"])
  }]
]);

const REQUIRED_LITERAL_TYPE_MEMBERS = new Map([
  ["SemanticTextCitation", {
    path: "/representation/data/types/semantic/derived-output.ts",
    members: new Map([["evidenceKind", "text"]])
  }]
]);

export const retiredMembersIn = (node, found) => {
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

export const missingRequiredMembersIn = (node, found) => {
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

export const invalidRequiredLiteralMembersIn = (node, found) => {
  const name = node.name?.text;
  const required = REQUIRED_LITERAL_TYPE_MEMBERS.get(name);
  if (
    required === undefined ||
    !node.getSourceFile().fileName.replaceAll("\\", "/").endsWith(required.path)
  ) return;
  const members = ts.isInterfaceDeclaration(node)
    ? node.members
    : ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)
      ? node.type.members
      : [];
  for (const [field, literal] of required.members) {
    const member = members.find((candidate) => memberName(candidate) === field);
    if (
      member === undefined ||
      !ts.isPropertySignature(member) ||
      member.questionToken !== undefined ||
      member.type === undefined ||
      typeMember(member.type) !== `literal:${literal}`
    ) found.add(`${name}.${field}!=${JSON.stringify(literal)}`);
  }
};
