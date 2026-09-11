import ts from "typescript";
import { memberName, exactTypeUnion, normalizedType, normalizedContractType, literalProperty, unwrappedType, literalFields, unionArms, exactFields, armNamed, intersectionLiteralWith } from "./shared.mjs";

export const presentationOpContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/presentations/op.ts") ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "PresentationTarget" && !exactTypeUnion(node.type, [
    "literal:slide",
    "literal:element",
    "literal:section",
    "literal:layout",
    "literal:block",
    "literal:atom",
    "literal:mark"
  ])) found.add("PresentationTarget.contract");
  if (node.name.text === "PresentationSetTarget" && !exactTypeUnion(node.type, [
    "literal:presentation",
    "reference:PresentationTarget"
  ])) found.add("PresentationSetTarget.contract");
  if (node.name.text !== "PresentationOp") return;
  const arms = ts.isUnionTypeNode(node.type) ? node.type.types : [node.type];
  const set = arms.find((arm) => literalProperty(arm, "op", "set") !== undefined);
  const target = ts.isTypeLiteralNode(set)
    ? set.members.find((member) => memberName(member) === "target")
    : undefined;
  if (
    set === undefined ||
    target === undefined ||
    !ts.isPropertySignature(target) ||
    target.questionToken !== undefined ||
    target.type === undefined ||
    normalizedType(target.type) !== "PresentationSetTarget"
  ) found.add("PresentationOp.set.target.contract");
};

export const formulaContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/content/content-block.ts") ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "FormulaBinding") {
    const arms = unionArms(node.type);
    const unbound = new Map([["formulaId", { optional: true, type: "never" }]]);
    const bound = new Map([["formulaId", { optional: false, type: 'Id<"formulas">' }]]);
    if (
      arms.length !== 2 ||
      !arms.some((arm) => exactFields(literalFields(arm), unbound)) ||
      !arms.some((arm) => exactFields(literalFields(arm), bound))
    ) found.add("FormulaBinding.contract");
  }
  if (node.name.text === "FormulaAtom" && !exactFields(
    intersectionLiteralWith(node.type, "FormulaBinding"),
    new Map([
      ["id", { optional: false, type: "string" }],
      ["kind", { optional: false, type: '"formula"' }],
      ["expression", { optional: false, type: "string" }],
      ["lastResolvedValue", { optional: false, type: "FormulaValue" }],
      ["lastResolvedDisplay", { optional: false, type: "string" }],
      ["state", { optional: false, type: '"fresh"' }]
    ])
  )) found.add("FormulaAtom.contract");
  if (node.name.text === "FormulaBlock" && !exactFields(
    intersectionLiteralWith(node.type, "FormulaBinding"),
    new Map([
      ["id", { optional: false, type: "string" }],
      ["type", { optional: false, type: '"formula"' }],
      ["expression", { optional: false, type: "string" }],
      ["display", { optional: false, type: "string" }],
      ["value", { optional: false, type: "FormulaValue" }],
      ["state", { optional: false, type: '"fresh"' }],
      ["format", { optional: true, type: "BlockFormat" }]
    ])
  )) found.add("FormulaBlock.contract");
};

const promptOwnerFields = (node, lifecycle) => {
  const held = unwrappedType(node);
  if (!ts.isIntersectionTypeNode(held) || held.types.length !== 2) return undefined;
  const base = held.types.map(unwrappedType).find((part) =>
    ts.isTypeReferenceNode(part) &&
    ts.isIdentifier(part.typeName) &&
    part.typeName.text === "PromptBlockBase" &&
    part.typeArguments?.length === 1 &&
    ts.isTypeReferenceNode(part.typeArguments[0]) &&
    ts.isIdentifier(part.typeArguments[0].typeName) &&
    part.typeArguments[0].typeName.text === lifecycle
  );
  return base === undefined ? undefined : held.types.map(unwrappedType).find(ts.isTypeLiteralNode);
};

export const promptBlockContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/content/content-block.ts") ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "PromptState" && !exactTypeUnion(node.type, [
    "literal:idle", "literal:fresh", "literal:stale", "literal:error"
  ])) found.add("PromptState.contract");
  if (node.name.text === "UnlinkedPromptLifecycle" && !exactFields(
    literalFields(node.type),
    new Map([
      ["state", { optional: false, type: '"idle"' }],
      ["error", { optional: true, type: "never" }],
      ["refreshedAt", { optional: true, type: "never" }]
    ])
  )) found.add("UnlinkedPromptLifecycle.contract");
  if (node.name.text === "LinkedPromptLifecycle") {
    const arms = unionArms(node.type);
    const expected = new Map([
      ["idle", new Map([
        ["state", { optional: false, type: '"idle"' }],
        ["error", { optional: true, type: "never" }],
        ["refreshedAt", { optional: true, type: "never" }]
      ])],
      ["stale", new Map([
        ["state", { optional: false, type: '"stale"' }],
        ["error", { optional: true, type: "never" }],
        ["refreshedAt", { optional: true, type: "number" }]
      ])],
      ["fresh", new Map([
        ["state", { optional: false, type: '"fresh"' }],
        ["error", { optional: true, type: "never" }],
        ["refreshedAt", { optional: false, type: "number" }]
      ])],
      ["error", new Map([
        ["state", { optional: false, type: '"error"' }],
        ["error", { optional: false, type: "string" }],
        ["refreshedAt", { optional: true, type: "number" }]
      ])]
    ]);
    if (
      arms.length !== expected.size ||
      [...expected].some(([state, fields]) =>
        !exactFields(literalFields(armNamed(arms, state)), fields)
      )
    ) found.add("LinkedPromptLifecycle.contract");
  }
  if (
    node.name.text === "PromptBlockBase" &&
    normalizedContractType(node.type) !== "PromptBlockPresentation&Lifecycle"
  ) found.add("PromptBlockBase.contract");
  if (node.name.text === "UnlinkedPromptBlock" && !exactFields(
    promptOwnerFields(node.type, "UnlinkedPromptLifecycle"),
    new Map([
      ["derivedOutputId", { optional: true, type: "never" }],
      ["scope", { optional: true, type: "ResourceSet|TemplatedResourceSet" }],
      ["prompt", { optional: true, type: "string" }]
    ])
  )) found.add("UnlinkedPromptBlock.contract");
  if (node.name.text === "LinkedPromptBlock" && !exactFields(
    promptOwnerFields(node.type, "LinkedPromptLifecycle"),
    new Map([
      ["derivedOutputId", { optional: false, type: 'Id<"derivedOutputs">' }],
      ["scope", { optional: true, type: "never" }],
      ["prompt", { optional: true, type: "never" }]
    ])
  )) found.add("LinkedPromptBlock.contract");
  if (node.name.text === "PromptBlock" && !exactTypeUnion(node.type, [
    "reference:UnlinkedPromptBlock",
    "reference:LinkedPromptBlock"
  ])) found.add("PromptBlock.contract");
};
