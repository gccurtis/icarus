import { randomUUID } from "node:crypto";

/**
 * Produces one collision-resistant identifier value.
 *
 * `randomUUID` is the whole procedure, and that is the point: the value carries
 * no kind, no prefix, and no ordering, so nothing about a consumer's identity
 * scheme is decided here. A consumer that wants `content_<uuid>` composes it.
 */
export const createIdentifier = (): string => randomUUID();
