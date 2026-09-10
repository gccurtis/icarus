import ts from "typescript";

export const memberName = (member) => {
  const name = member.name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
};

export const typeMember = (node) => {
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
    return `literal:${node.literal.text}`;
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    return `reference:${node.typeName.text}`;
  }
  return `syntax:${node.kind}`;
};

export const exactTypeUnion = (node, expected) => {
  const members = (ts.isUnionTypeNode(node) ? node.types : [node]).map(typeMember).sort();
  const sortedExpected = [...expected].sort();
  return members.length === sortedExpected.length &&
    members.every((member, index) => member === sortedExpected[index]);
};

export const normalizedType = (node) => node?.getText().replace(/\s+/g, "");

export const normalizedContractType = (node) => normalizedType(node)
  ?.replaceAll(";}", "}")
  .replace("&(|", "&(")
  .replace(/^\|/, "");

export const literalProperty = (literal, name, value) => {
  if (!ts.isTypeLiteralNode(literal)) return undefined;
  return literal.members.find((member) =>
    ts.isPropertySignature(member) &&
    memberName(member) === name &&
    member.type !== undefined &&
    typeMember(member.type) === `literal:${value}`
  );
};

export const unwrappedType = (node) => {
  let held = node;
  while (held !== undefined && ts.isParenthesizedTypeNode(held)) held = held.type;
  return held;
};

export const literalFields = (node) => {
  const held = unwrappedType(node);
  if (held === undefined) return undefined;
  if (ts.isTypeLiteralNode(held)) return held;
  if (!ts.isIntersectionTypeNode(held)) return undefined;
  return held.types.map(unwrappedType).find(ts.isTypeLiteralNode);
};

export const unionArms = (node) => {
  const held = unwrappedType(node);
  if (held === undefined) return [];
  return (ts.isUnionTypeNode(held) ? held.types : [held]).map(unwrappedType);
};

export const exactFields = (literal, expected) => {
  if (literal === undefined || literal.members.length !== expected.size) return false;
  for (const member of literal.members) {
    if (!ts.isPropertySignature(member) || member.type === undefined) return false;
    const name = memberName(member);
    const wanted = name === undefined ? undefined : expected.get(name);
    if (
      wanted === undefined ||
      (member.questionToken !== undefined) !== wanted.optional ||
      normalizedType(member.type) !== wanted.type
    ) return false;
  }
  return true;
};

export const armNamed = (arms, state) => arms.find((arm) => {
  const fields = literalFields(arm);
  const discriminator = fields?.members.find((member) => memberName(member) === "state");
  return discriminator !== undefined && ts.isPropertySignature(discriminator) &&
    discriminator.type !== undefined && normalizedType(discriminator.type).includes(`"${state}"`);
});

export const intersectionLiteralWith = (node, baseName) => {
  const held = unwrappedType(node);
  if (!ts.isIntersectionTypeNode(held) || held.types.length !== 2) return undefined;
  const base = held.types.map(unwrappedType).find((part) =>
    ts.isTypeReferenceNode(part) &&
    ts.isIdentifier(part.typeName) &&
    part.typeName.text === baseName &&
    part.typeArguments === undefined
  );
  return base === undefined ? undefined : held.types.map(unwrappedType).find(ts.isTypeLiteralNode);
};
