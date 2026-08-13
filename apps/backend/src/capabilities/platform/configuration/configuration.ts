import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const configurationDirectory: string = dirname(
  fileURLToPath(import.meta.resolve(`#configuration/${"server.yaml"}`))
);

export interface Configuration {
  get(key: string): unknown;
}

type ConfigurationObject = Record<string, unknown>;

const LOCAL_FILE = "local.yaml";

const isConfigurationObject = (value: unknown): value is ConfigurationObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const copyValue = (value: unknown): unknown => {
  if (isConfigurationObject(value)) {
    return merge({}, value);
  }

  if (Array.isArray(value)) {
    return value.map(copyValue);
  }

  return value;
};

/** Overlay wins. Nested plain objects merge; every other value replaces. */
const merge = (
  base: ConfigurationObject,
  overlay: ConfigurationObject
): ConfigurationObject => {
  const result: ConfigurationObject = Object.create(null) as ConfigurationObject;

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

const freeze = (value: unknown): unknown => {
  if (isConfigurationObject(value)) {
    for (const child of Object.values(value)) {
      freeze(child);
    }
    return Object.freeze(value);
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      freeze(child);
    }
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
    const value = parse(await readFile(path, "utf-8"));
    if (!isConfigurationObject(value)) {
      throw new Error("expected a YAML mapping at the document root");
    }
    return value;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid configuration file '${name}': ${reason}`, {
      cause: error
    });
  }
};

const getValue = (root: ConfigurationObject, key: string): unknown => {
  const segments = key.split(".");
  if (key.length === 0 || segments.some((segment) => segment.length === 0)) {
    return undefined;
  }

  let value: unknown = root;
  for (const segment of segments) {
    if (!isConfigurationObject(value) || !Object.hasOwn(value, segment)) {
      return undefined;
    }
    value = value[segment];
  }
  return value;
};

/**
 * Reads every YAML section once and returns an immutable configuration snapshot.
 *
 * Section files are merged in lexicographic order; optional `local.yaml` always
 * merges last. Values are intentionally returned as `unknown` so every consumer
 * owns the validation rules for the keys it uses.
 */
export const createConfiguration = async (): Promise<Configuration> => {
  const entries = (await readdir(configurationDirectory))
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  const sectionNames = entries.filter((name) => name !== LOCAL_FILE);
  const names = entries.includes(LOCAL_FILE)
    ? [...sectionNames, LOCAL_FILE]
    : sectionNames;

  let root: ConfigurationObject = Object.create(null) as ConfigurationObject;
  for (const name of names) {
    root = merge(root, await readConfigurationFile(configurationDirectory, name));
  }

  freeze(root);
  return Object.freeze({
    get: (key: string): unknown => getValue(root, key)
  });
};
