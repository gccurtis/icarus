import { createIdentifier } from "#id-factory/runtime-api/create/create.js";

/**
 * Generates identifier values for every capability that allocates identity.
 *
 * It is deliberately ignorant of what an identifier names. A capability keeps
 * its own semantics — which kinds exist, when one is allocated, what prefix it
 * carries — and asks this object only for a value nothing else will produce.
 */
export interface IdFactory {
  create(): string;
}

/** The UUID-backed implementation. Stateless; one instance per runtime. */
export class UuidIdFactory implements IdFactory {
  create(): string {
    return createIdentifier();
  }
}
