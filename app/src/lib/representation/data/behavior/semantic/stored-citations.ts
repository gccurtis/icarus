import {
  externalFileResourceKind,
  isResourceRef
} from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredChoice,
  isStoredFinite,
  isStoredIdentifier,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { SemanticCitation } from "$representation/data/types/semantic/derived-output";

const selections = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every((entry) => {
    const selection = storedFields(entry);
    return selection !== undefined && hasExactFields(selection, ["evidenceId", "use"]) &&
      isStoredIdentifier(selection.evidenceId) && isStoredText(selection.use, 10_000) &&
      selection.use.length > 0;
  });

const span = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, ["from", "to", "text"]) &&
    isStoredNatural(held.from) && isStoredNatural(held.to) && held.to > held.from &&
    isStoredText(held.text);
};

const locator = (value: unknown, use: "semantic" | "material"): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.kind === "documentBlock") {
    return hasExactFields(held, ["kind", "area", "rowId", "blockPath"]) &&
      isStoredChoice(held.area, ["body", "header", "firstPageHeader", "footer", "firstPageFooter"]) &&
      isStoredIdentifier(held.rowId) && Array.isArray(held.blockPath) &&
      held.blockPath.every((part) => isStoredIdentifier(part));
  }
  if (held.kind === "slideElement") {
    return hasExactFields(
      held,
      use === "semantic"
        ? ["kind", "slideId", "elementPath", "blockPath"]
        : ["kind", "slideId", "elementPath"],
      use === "material" ? ["blockPath"] : []
    ) &&
      isStoredIdentifier(held.slideId) && Array.isArray(held.elementPath) &&
      held.elementPath.every((part) => isStoredIdentifier(part)) &&
      (use === "semantic"
        ? Array.isArray(held.blockPath) && held.blockPath.every((part) => isStoredIdentifier(part))
        : held.blockPath === undefined || (
          Array.isArray(held.blockPath) && held.blockPath.every((part) => isStoredIdentifier(part))
        ));
  }
  if (held.kind === "slideBackground") {
    return hasExactFields(held, ["kind", "slideId"]) && isStoredIdentifier(held.slideId);
  }
  if (held.kind === "slideNote") {
    return hasExactFields(held, ["kind", "slideId", "blockPath"]) &&
      isStoredIdentifier(held.slideId) && Array.isArray(held.blockPath) &&
      held.blockPath.every((part) => isStoredIdentifier(part));
  }
  if (held.kind === "spreadsheet") {
    return hasExactFields(held, ["kind", "rowIds", "columnIds"]) &&
      Array.isArray(held.rowIds) && held.rowIds.every((rowId) => isStoredIdentifier(rowId)) &&
      Array.isArray(held.columnIds) &&
      held.columnIds.every((columnId) => isStoredIdentifier(columnId));
  }
  return use === "semantic" && held.kind === "externalFileContent" &&
    hasExactFields(held, ["kind"]);
};

export const isStoredSemanticLocator = (value: unknown): boolean =>
  locator(value, "semantic");

export const isStoredMaterialLocator = (value: unknown): boolean =>
  locator(value, "material");

const locatorSpan = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, ["from", "to", "locator"]) &&
    isStoredNatural(held.from) && isStoredNatural(held.to) && held.to > held.from &&
    locator(held.locator, "semantic");
};

const sourceSnapshot = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, ["ref", "revision", "encoding"], ["contentHash"]) &&
    isResourceRef(held.ref) && isStoredNatural(held.revision) &&
    (held.contentHash === undefined || isStoredText(held.contentHash, 1_000)) &&
    (held.encoding === "utf-8" || held.encoding === "utf-16");
};

export const isStoredMaterialSource = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.kind === "resourceContent") {
    return hasExactFields(held, ["kind", "ref", "revision", "locator"]) &&
      isResourceRef(held.ref) && isStoredNatural(held.revision) &&
      locator(held.locator, "material");
  }
  if (
    held.kind !== "externalFile" ||
    !hasExactFields(held, ["kind", "ref", "fileId", "hash", "mediaType", "subkind"]) ||
    !isStoredChoice(held.subkind, ["text", "code", "data", "image", "audio", "video", "unknown"]) ||
    !isResourceRef(held.ref) ||
    !isStoredRowId(held.fileId, "externalFiles") ||
    held.ref.kind !== externalFileResourceKind(held.subkind) ||
    held.ref.id !== held.fileId
  ) return false;
  return isStoredText(held.hash, 1_000) && held.hash.length > 0 &&
    isStoredText(held.mediaType, 500);
};

export const isStoredMaterialSnapshot = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined || !hasExactFields(
    held,
    ["materialId", "kind", "name", "source", "profileHash", "contextHash", "revisionKey"],
    ["placement"]
  ) || !isStoredRowId(held.materialId, "semanticMaterials") ||
    !isStoredChoice(held.kind, ["table", "csv", "chart", "image", "code"]) ||
    !isStoredText(held.name, 10_000) || !isStoredMaterialSource(held.source) ||
    ![held.profileHash, held.contextHash, held.revisionKey].every((entry) =>
      isStoredText(entry, 1_000) && entry.length > 0
    )) return false;
  if (held.placement === undefined) return true;
  const placement = storedFields(held.placement);
  return placement !== undefined && hasExactFields(placement, ["ref", "revision", "locator"]) &&
    isResourceRef(placement.ref) && isStoredNatural(placement.revision) &&
    locator(placement.locator, "material");
};

export const isStoredMaterialNativeSelection = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.kind === "table") {
    return hasExactFields(held, ["kind", "rows", "columns"]) &&
      Array.isArray(held.rows) && held.rows.every(isStoredNatural) &&
      Array.isArray(held.columns) && held.columns.every(isStoredNatural);
  }
  if (held.kind === "csv") {
    return hasExactFields(held, ["kind", "rows", "columns"]) &&
      Array.isArray(held.rows) && held.rows.every(isStoredNatural) &&
      Array.isArray(held.columns) && held.columns.every((entry) => isStoredText(entry, 10_000));
  }
  if (held.kind === "chart") {
    return hasExactFields(held, ["kind", "series"]) && Array.isArray(held.series) &&
      held.series.every((entry) => isStoredText(entry, 10_000));
  }
  if (held.kind === "image") {
    if (!hasExactFields(held, ["kind"], ["crop"])) return false;
    if (held.crop === undefined) return true;
    const crop = storedFields(held.crop);
    return crop !== undefined && hasExactFields(crop, ["x", "y", "width", "height"]) &&
      [crop.x, crop.y, crop.width, crop.height].every(isStoredFinite);
  }
  return held.kind === "code" && hasExactFields(held, ["kind", "fromLine", "toLine"]) &&
    isStoredNatural(held.fromLine) && isStoredNatural(held.toLine) && held.toLine >= held.fromLine;
};

/** Exact current semantic citation admission across its three discriminated arms. */
export const isStoredSemanticCitation = (value: unknown): value is SemanticCitation => {
  const held = storedFields(value);
  if (held === undefined || !selections(held.selections) || !isStoredNatural(held.overlayGeneration)) {
    return false;
  }
  if (held.evidenceKind === "text") {
    return hasExactFields(
      held,
      ["evidenceKind", "selections", "source", "span", "overlayGeneration"],
      ["locators", "partition"]
    ) && sourceSnapshot(held.source) && span(held.span) &&
      (held.locators === undefined || (Array.isArray(held.locators) && held.locators.every(locatorSpan))) &&
      (held.partition === undefined || isStoredText(held.partition, 1_000));
  }
  if (held.evidenceKind === "descriptor") {
    const base = held.distance === 2 && isStoredMaterialSnapshot(held.material) &&
      isStoredText(held.text) && held.text.length > 0 &&
      isStoredText(held.inputHash, 1_000) && held.inputHash.length > 0;
    if (!base) return false;
    if (held.facet === "generated") {
      return hasExactFields(held, [
        "evidenceKind", "distance", "selections", "material", "facet", "text", "inputHash",
        "model", "promptVersion", "overlayGeneration"
      ]) && isStoredText(held.model, 500) && held.model.length > 0 &&
        isStoredText(held.promptVersion, 500) && held.promptVersion.length > 0;
    }
    return isStoredChoice(held.facet, ["identity", "profile", "authored", "nativeVisual"]) &&
      hasExactFields(held, [
        "evidenceKind", "distance", "selections", "material", "facet", "text", "inputHash",
        "overlayGeneration"
      ]);
  }
  return (held.evidenceKind === "structured" || held.evidenceKind === "visual" || held.evidenceKind === "code") &&
    hasExactFields(
      held,
      ["evidenceKind", "distance", "selections", "material", "selection", "value", "overlayGeneration"]
    ) && (held.distance === 0 || held.distance === 1) &&
    isStoredMaterialSnapshot(held.material) &&
    isStoredMaterialNativeSelection(held.selection) &&
    isStoredJson(held.value);
};
