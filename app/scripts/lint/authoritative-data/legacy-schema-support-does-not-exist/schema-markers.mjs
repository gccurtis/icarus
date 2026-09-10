import ts from "typescript";

import {
  currentReadMarkersIn,
  currentReadStateFor
} from "./defaulted-current-reads.mjs";
import { typeContractMarkersIn } from "./type-contracts.mjs";

const LEGACY = /legacy|deprecated|compatibility|migration|migrate/i;

export const hasLegacyPathPart = (relative) =>
  relative.split("/").some((part) => LEGACY.test(part));

export const schemaMarkersIn = (tree, path) => {
  const found = new Set();
  for (const script of tree.scripts(path)) {
    const readState = currentReadStateFor(script.source, path);
    const visit = (node) => {
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
        typeContractMarkersIn(node, path, found);
      }
      currentReadMarkersIn(node, readState, found);
      if (
        (ts.isIdentifier(node) || ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        LEGACY.test(node.text)
      ) found.add(node.text);
      node.forEachChild(visit);
    };
    visit(script.source);
  }
  return [...found].sort();
};
