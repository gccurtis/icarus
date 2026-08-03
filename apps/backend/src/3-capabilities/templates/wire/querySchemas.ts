import { TemplateWireError } from "../domain/errors.js";
import type { TemplateQuery, TemplateQueryRequest } from "../domain/model.js";
import {
  exactKeys,
  optionalText,
  record,
  requireIdentifier,
  requireIdentifierList,
  requirePageLimit,
  TEMPLATE_WIRE_LIMITS
} from "./valueSchemas.js";

const QUERY_KEYS: Record<TemplateQuery["type"], readonly string[]> = {
  "template.get": ["type", "templateId"],
  "template.list": ["type", "kinds", "search", "limit", "cursor"],
  "template.load": ["type", "templateId"]
};

/**
 * Opaque to a caller, so this only checks it is a plausibly-sized string. The
 * store decides whether it is a cursor *it* issued.
 */
const requireCursor = (
  value: Record<string, unknown>,
  key: string,
  label: string
): string => {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new TemplateWireError(`${label} must be a non-empty string`);
  }
  if (Buffer.byteLength(candidate, "utf8") > TEMPLATE_WIRE_LIMITS.maxCursorBytes) {
    throw new TemplateWireError(`${label} exceeds the size limit`);
  }
  return candidate;
};

const decodeQuery = (value: unknown): TemplateQuery => {
  const query = record(value, "Template query");
  const type = query.type;
  if (typeof type !== "string" || !(type in QUERY_KEYS)) {
    throw new TemplateWireError("Template query type is not recognised");
  }
  const queryType = type as TemplateQuery["type"];
  exactKeys(query, QUERY_KEYS[queryType], `Template query '${queryType}'`);

  switch (queryType) {
    case "template.get":
      return {
        type: "template.get",
        templateId: requireIdentifier(query, "templateId", "Template templateId")
      };
    case "template.list": {
      const search = optionalText(
        query,
        "search",
        "Template search",
        TEMPLATE_WIRE_LIMITS.maxSearchBytes
      );
      return {
        type: "template.list",
        ...(query.kinds !== undefined
          ? { kinds: requireIdentifierList(query, "kinds", "Template kinds") }
          : {}),
        // Trimmed, because a search of only whitespace is a search for nothing
        // and should list everything rather than nothing.
        ...(search !== undefined && search.trim().length > 0
          ? { search: search.trim() }
          : {}),
        ...(query.limit !== undefined
          ? { limit: requirePageLimit(query, "limit", "Template limit") }
          : {}),
        ...(query.cursor !== undefined
          ? { cursor: requireCursor(query, "cursor", "Template cursor") }
          : {})
      };
    }
    case "template.load":
      return {
        type: "template.load",
        templateId: requireIdentifier(query, "templateId", "Template templateId")
      };
  }
};

export const decodeTemplateQuery = (value: unknown): TemplateQueryRequest => {
  const body = record(value, "Template query request");
  exactKeys(body, ["query"], "Template query request");
  return { query: decodeQuery(body.query) };
};
