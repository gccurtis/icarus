import { AnalyticWireError } from "../domain/errors.js";
import type { AnalyticQuery } from "../domain/model.js";
import { exactKeys, record, requiredString } from "./common.js";

const QUERY_TYPES = [
  "analytic.get",
  "analytic.list",
  "analytic.pull",
  "analytic.check"
] as const;

export const decodeAnalyticQuery = (body: unknown): AnalyticQuery => {
  const envelope = record(body, "Structured Analytic query");

  const type = envelope.type;
  if (typeof type !== "string" || !(QUERY_TYPES as readonly string[]).includes(type)) {
    throw new AnalyticWireError(
      `Structured Analytic query type must be one of: ${QUERY_TYPES.join(", ")}`
    );
  }

  if (type === "analytic.list") {
    // No cursor: the catalog is unpaginated by design. Rejecting a supplied
    // `cursor` rather than ignoring it means a client that expects paging finds
    // out now rather than by silently reading only the first page forever.
    exactKeys(envelope, ["type"], type);
    return { type };
  }

  exactKeys(envelope, ["type", "id"], type);
  const id = requiredString(envelope, "id", type);
  return { type: type as "analytic.get" | "analytic.pull" | "analytic.check", id };
};
