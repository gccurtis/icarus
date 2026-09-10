import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { Configuration, ConfigurationObject } from "$model/server/configuration/types";
import { isConfigurationObject } from "$model/server/configuration/types";
import { SnapshotConfiguration } from "$model/server/configuration/definition";

const LOCAL_FILE = "local.yaml";
const OVERLAY_ENVIRONMENT_KEY = "ICARUS_CONFIGURATION_OVERLAY";
const DIRECTORY_ENVIRONMENT_KEY = "ICARUS_CONFIGURATION_DIRECTORY";

/** Keep an opt-in overlay confined to one tracked subdirectory and out of the default merge. */
export const configurationFileOrder = (
  entries: readonly string[],
  overlay: string | undefined
): string[] => {
  const sections = entries.filter((name) => name.endsWith(".yaml") && name !== LOCAL_FILE).sort();
  const names = entries.includes(LOCAL_FILE) ? [...sections, LOCAL_FILE] : sections;
  if (overlay === undefined || overlay.length === 0) return names;
  if (!/^overlays\/[a-z0-9][a-z0-9.-]*\.yaml$/i.test(overlay)) {
    throw new Error(
      `${OVERLAY_ENVIRONMENT_KEY} must name one YAML file directly inside configuration/overlays`
    );
  }
  return [...names, overlay];
};

/**
 * Where the YAML lives, normally resolved from the process working directory.
 *
 * Deliberately *not* derived from this module's own location. Under Vite this
 * file is bundled into a chunk under `build/server/`, so `import.meta.url` would
 * resolve to a directory that exists and is wrong — a failure that produces an
 * empty configuration rather than an error. The backend derived it that way and
 * it is one of the three path derivation defects corrected in this implementation.
 *
 * `pnpm dev` and `node build/index.js` are both run from the package root. An
 * explicit directory lets an isolated process use a disposable configuration
 * snapshot without writing generated values into the source tree.
 */
const configuredDirectory = process.env[DIRECTORY_ENVIRONMENT_KEY]?.trim();
const configurationDirectory =
  configuredDirectory === undefined || configuredDirectory.length === 0
    ? join(process.cwd(), "configuration")
    : configuredDirectory;

const copyValue = (value: unknown): unknown => {
  if (isConfigurationObject(value)) return merge({}, value);
  if (Array.isArray(value)) return value.map(copyValue);
  return value;
};

/**
 * Overlay wins. Nested plain objects merge; every other value replaces.
 *
 * Exported because it is pure, which is what lets the merge rules be proven
 * against object literals rather than against a directory of fixtures.
 */
export const merge = (
  base: ConfigurationObject,
  overlay: ConfigurationObject
): ConfigurationObject => {
  const result = Object.create(null) as ConfigurationObject;

  for (const [key, value] of Object.entries(base)) {
    result[key] = copyValue(value);
  }

  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];
    result[key] =
      isConfigurationObject(existing) && isConfigurationObject(value)
        ? merge(existing, value)
        : copyValue(value);
  }

  return result;
};

/**
 * Freezes the whole tree.
 *
 * Configuration is read by everything and owned by nobody, so a consumer that
 * mutated what it read would change what every later reader sees — a bug that
 * surfaces far from its cause. Freezing turns it into a throw at the write.
 */
export const freeze = (value: unknown): unknown => {
  if (isConfigurationObject(value)) {
    for (const child of Object.values(value)) freeze(child);
    return Object.freeze(value);
  }

  if (Array.isArray(value)) {
    for (const child of value) freeze(child);
    return Object.freeze(value);
  }

  return value;
};

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
 * Sections merge in lexicographic order and optional `local.yaml` merges after
 * them. A confined, explicitly selected overlay may merge last for an isolated
 * process such as a browser test. Values come back as `unknown` on purpose: the
 * consumer that reads a key is the only thing that knows whether it may be absent.
 *
 * Reading is the whole of this object's acquisition, and it either completes or
 * throws — there is no half-read snapshot to release.
 */
export const createConfiguration = async (): Promise<Configuration> => {
  const entries = await readdir(configurationDirectory);
  const names = configurationFileOrder(entries, process.env[OVERLAY_ENVIRONMENT_KEY]);

  let root = Object.create(null) as ConfigurationObject;
  for (const name of names) {
    root = merge(root, await readConfigurationFile(configurationDirectory, name));
  }

  freeze(root);
  return Object.freeze(new SnapshotConfiguration(root));
};
