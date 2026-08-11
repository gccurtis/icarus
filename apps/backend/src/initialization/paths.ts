import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute filesystem paths, anchored through the package's imports map rather
 * than to any module's own location.
 *
 * Resolving `../..` from `import.meta.url` couples a path to the depth of
 * whichever file happens to read it, so moving that file silently breaks it.
 * That bug shipped twice during the restructure and `tsc` caught neither time,
 * because a string is a valid string wherever it points.
 *
 * `import.meta.resolve` goes through the imports map instead, so every value
 * here is the same no matter which module asks or how deep it sits.
 */

/** `apps/backend`, anchored on the one file guaranteed to sit at a package root. */
export const packageRoot: string = dirname(fileURLToPath(import.meta.resolve("#package.json")));

/** A checked-in file under `configuration/`. Existence is not checked. */
export const configurationFile = (name: string): string =>
  fileURLToPath(import.meta.resolve(`#configuration/${name}`));

/**
 * The `configuration/` directory, for listing its files.
 *
 * Derived from a resolved alias rather than from this module's location, so it
 * follows the same rule as everything else here.
 */
export const configurationDirectory: string = dirname(configurationFile("server.yaml"));

/**
 * The repository-root `.env`, two levels above this package.
 *
 * This one cannot be an alias: an imports-map target may not escape its own
 * package. Anchoring it to `packageRoot` still removes the fragile part — it
 * survives files moving inside the package, and only changes if the package
 * itself relocates.
 */
export const repositoryEnvFile: string = resolve(packageRoot, "../../.env");
