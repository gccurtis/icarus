import { TemplateWireError } from "../domain/errors.js";
import type { TemplateQuery, TemplateQueryRequest } from "../domain/model.js";
import { exactKeys, record, requireIdentifier } from "./valueSchemas.js";

const QUERY_KEYS: Record<TemplateQuery["type"], readonly string[]> = {
  "template.get": ["type", "templateId"],
  "template.list": ["type", "kind"],
  "template.load": ["type", "templateId"]
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
    case "template.list":
      return {
        type: "template.list",
        ...(query.kind !== undefined
          ? { kind: requireIdentifier(query, "kind", "Template kind") }
          : {})
      };
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
