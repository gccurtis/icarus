import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { Configuration, ConfigurationObject } from "$runtime/server/configuration/types";
import { isConfigurationObject } from "$runtime/server/configuration/types";
import { SnapshotConfiguration, freeze, merge } from "$runtime/server/configuration/snapshot";

export type { Configuration } from "$runtime/server/configuration/types";

const LOCAL_FILE = "local.yaml";

/**
 * Where the YAML lives, resolved from the process working directory.
 *
 * Deliberately *not* derived from this module's own location. Under Vite this
 * file is bundled into a chunk under `build/server/`, so `import.meta.url` would
 * resolve to a directory that exists and is wrong — a failure that produces an
 * empty configuration rather than an error. The backend derived it that way and
 * it is one of the three path derivations this migration had to fix.
 *
 * `pnpm dev` and `node build/index.js` are both run from the package root.
 */
const configurationDirectory = join(process.cwd(), "configuration");

const readConfigurationFile = async (
  directory: string,
  name: string
): Promise<ConfigurationObject> => {
  const path = join(directory, name);

  try {
    const value: unknown = parse(await readFile(path, "utf-8"));
    if (!isConfigurationObject(value)) {
      throw new Error("expected a YAML mapping at the document root");
    }
    return value;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid configuration file '${name}': ${reason}`, { cause: error });
  }
};

/**
 * Reads every YAML section once and returns an immutable snapshot.
 *
 * Sections merge in lexicographic order and optional `local.yaml` merges last,
 * which is what makes it the place for a real API key without touching a tracked
 * file. Values come back as `unknown` on purpose: the consumer that reads a key
 * is the only thing that knows whether it may be absent.
 */
export const createConfiguration = async (): Promise<Configuration> => {
  const entries = (await readdir(configurationDirectory))
    .filter((name) => name.endsWith(".yaml"))
    .sort();

  const sections = entries.filter((name) => name !== LOCAL_FILE);
  const names = entries.includes(LOCAL_FILE) ? [...sections, LOCAL_FILE] : sections;

  let root = Object.create(null) as ConfigurationObject;
  for (const name of names) {
    root = merge(root, await readConfigurationFile(configurationDirectory, name));
  }

  freeze(root);
  return Object.freeze(new SnapshotConfiguration(root));
};

/**
 * Reads a key that must be a non-empty string, throwing when it is not.
 *
 * Here rather than in each consumer because "required string" is the shape
 * almost every key has, and eight hand-written copies of the same check drift.
 * A key with a richer shape validates itself where it is read.
 */
export const requiredString = (configuration: Configuration, key: string): string => {
  const value = configuration.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Configuration key '${key}' must be a non-empty string`);
  }
  return value;
};
