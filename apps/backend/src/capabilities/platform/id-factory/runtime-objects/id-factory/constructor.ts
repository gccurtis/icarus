import type { IdFactory } from "#id-factory/runtime-objects/id-factory/definition.js";
import { UuidIdFactory } from "#id-factory/runtime-objects/id-factory/definition.js";

/**
 * Creates the ID factory a backend runtime shares.
 *
 * It takes no parameters and performs no startup work: there is nothing to
 * open, seed, or reserve. `main.ts` still constructs exactly one, so that every
 * capability draws values from the same object and a future change of scheme
 * has one place to happen.
 */
export const createIdFactory = (): IdFactory => new UuidIdFactory();
