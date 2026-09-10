import ts from "typescript";
import { exactTypeUnion, normalizedContractType, unwrappedType, literalFields, unionArms, exactFields } from "./shared.mjs";

export const semanticMaterialContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/semantic/material.ts") ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "MaterialState" && !exactTypeUnion(node.type, ["literal:ready"])) {
    found.add("MaterialState.contract");
  }
  if (node.name.text === "SemanticMaterialFields" && !exactFields(
    literalFields(node.type),
    new Map([
      ["projectId", { optional: false, type: 'Id<"projects">' }],
      ["identityKey", { optional: false, type: "string" }],
      ["kind", { optional: false, type: "MaterialKind" }],
      ["name", { optional: false, type: "string" }],
      ["source", { optional: false, type: "MaterialSource" }],
      ["profile", { optional: false, type: "MaterialProfile" }],
      ["profileHash", { optional: false, type: "string" }],
      ["contextHash", { optional: false, type: "string" }],
      ["revisionKey", { optional: false, type: "string" }],
      ["userDescription", { optional: true, type: "string" }],
      ["descriptor", { optional: true, type: "GeneratedMaterialDescriptor" }],
      ["state", { optional: false, type: "MaterialState" }],
      ["error", { optional: true, type: "string" }],
      ["updatedAt", { optional: false, type: "number" }]
    ])
  )) found.add("SemanticMaterialFields.contract");
};

export const materialDescriptorContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith(
      "/representation/data/types/semantic/derived-output.ts"
    ) ||
    !ts.isTypeAliasDeclaration(node) ||
    node.name.text !== "MaterialDescriptorCitation"
  ) return;
  const held = unwrappedType(node.type);
  const base = ts.isIntersectionTypeNode(held)
    ? held.types.map(unwrappedType).find((part) =>
      ts.isTypeReferenceNode(part) &&
      ts.isIdentifier(part.typeName) &&
      part.typeName.text === "MaterialDescriptorCitationBase"
    )
    : undefined;
  const variants = ts.isIntersectionTypeNode(held)
    ? held.types.map(unwrappedType).find(ts.isUnionTypeNode)
    : undefined;
  const arms = variants === undefined ? [] : unionArms(variants);
  const generated = new Map([
    ["facet", { optional: false, type: '"generated"' }],
    ["model", { optional: false, type: "string" }],
    ["promptVersion", { optional: false, type: "string" }]
  ]);
  const other = new Map([
    ["facet", { optional: false, type: 'Exclude<MaterialFacetKind,"generated">' }],
    ["model", { optional: true, type: "never" }],
    ["promptVersion", { optional: true, type: "never" }]
  ]);
  if (
    base === undefined ||
    arms.length !== 2 ||
    !arms.some((arm) => exactFields(literalFields(arm), generated)) ||
    !arms.some((arm) => exactFields(literalFields(arm), other))
  ) found.add("MaterialDescriptorCitation.contract");
};

export const derivedOutputLifecycleContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith(
      "/representation/data/types/semantic/derived-output.ts"
    ) ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "DerivedOutputWithoutValue" && !exactFields(
    literalFields(node.type),
    new Map([
      ["valueSource", { optional: false, type: '"none"' }],
      ["queries", { optional: false, type: "[]" }],
      ["evidence", { optional: false, type: "[]" }],
      ["lastVariables", { optional: true, type: "never" }],
      ["lastResponse", { optional: true, type: "never" }],
      ["lastRevision", { optional: true, type: "never" }],
      ["lastGeneration", { optional: true, type: "never" }],
      ["refreshedAt", { optional: true, type: "never" }]
    ])
  )) found.add("DerivedOutputWithoutValue.contract");
  if (node.name.text === "DerivedOutputWithAuthoredValue" && !exactFields(
    literalFields(node.type),
    new Map([
      ["valueSource", { optional: false, type: '"authored"' }],
      ["queries", { optional: false, type: "[]" }],
      ["evidence", { optional: false, type: "[]" }],
      ["lastVariables", { optional: true, type: "never" }],
      ["lastResponse", { optional: false, type: "ContentBlock" }],
      ["lastRevision", { optional: false, type: "number" }],
      ["lastGeneration", { optional: true, type: "never" }],
      ["refreshedAt", { optional: true, type: "never" }]
    ])
  )) found.add("DerivedOutputWithAuthoredValue.contract");
  if (node.name.text === "DerivedOutputWithGeneratedValue" && !exactFields(
    literalFields(node.type),
    new Map([
      ["valueSource", { optional: false, type: '"generated"' }],
      ["queries", { optional: false, type: "string[]" }],
      ["evidence", { optional: false, type: "SemanticCitation[]" }],
      ["lastVariables", { optional: true, type: "DerivedVariableResolution[]" }],
      ["lastResponse", { optional: false, type: "ContentBlock" }],
      ["lastRevision", { optional: false, type: "number" }],
      ["lastGeneration", { optional: false, type: "number" }],
      ["refreshedAt", { optional: false, type: "number" }]
    ])
  )) found.add("DerivedOutputWithGeneratedValue.contract");
  if (node.name.text === "DerivedOutputValue" && !exactTypeUnion(node.type, [
    "reference:DerivedOutputWithoutValue",
    "reference:DerivedOutputWithAuthoredValue",
    "reference:DerivedOutputWithGeneratedValue"
  ])) found.add("DerivedOutputValue.contract");
  if (
    node.name.text === "DerivedOutputFields" &&
    normalizedContractType(node.type) !==
      'DerivedOutputBaseFields&((DerivedOutputWithoutValue&{state:"idle";error?:never})|(DerivedOutputValue&{state:"stale";error?:never})|(DerivedOutputWithGeneratedValue&{state:"fresh";error?:never})|(DerivedOutputValue&{state:"error";error:string}))'
  ) found.add("DerivedOutputFields.lifecycle.contract");
  if (node.name.text === "DerivedOutputRefreshJobBaseFields" && !exactFields(
    literalFields(node.type),
    new Map([
      ["projectId", { optional: false, type: 'Id<"projects">' }],
      ["derivedOutputId", { optional: false, type: 'Id<"derivedOutputs">' }],
      ["selection", { optional: true, type: "DerivedOutputSelection" }],
      ["requestKey", { optional: false, type: "string" }],
      ["requestedVersion", { optional: false, type: "number" }],
      ["attempts", { optional: false, type: "number" }],
      ["queuedAt", { optional: false, type: "number" }],
      ["updatedAt", { optional: false, type: "number" }]
    ])
  )) found.add("DerivedOutputRefreshJobBaseFields.contract");
  if (
    node.name.text === "DerivedOutputRefreshJobFields" &&
    normalizedContractType(node.type) !==
      'DerivedOutputRefreshJobBaseFields&({state:"queued";error?:never;startedAt?:never}|{state:"running";error?:never;startedAt:number}|{state:"failed";error:string;startedAt:number})'
  ) found.add("DerivedOutputRefreshJobFields.lifecycle.contract");
};

export const semanticJobLifecycleContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/semantic/sync.ts") ||
    !ts.isTypeAliasDeclaration(node) ||
    node.name.text !== "SemanticJobLifecycle"
  ) return;
  if (
    normalizedContractType(node.type) !==
      '{state:"queued";error?:never;startedAt?:never;claimId?:never;leaseExpiresAt?:never}|{state:"running";error?:never;startedAt:number;claimId:string;leaseExpiresAt:number}|{state:"failed";error:string;startedAt?:never;claimId?:never;leaseExpiresAt?:never}'
  ) found.add("SemanticJobLifecycle.contract");
};
