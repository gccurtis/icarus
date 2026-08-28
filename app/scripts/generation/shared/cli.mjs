/**
 * How a generator is invoked.
 *
 * Every standard documents its generator as `pnpm <script> -- <args>`, and pnpm
 * forwards that `--` to the script rather than consuming it. Reading `argv`
 * directly makes the one invocation anybody will copy fail on its first word.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Where the generator writes. `ICARUS_PACKAGE_ROOT` is how a test points one at
 * a copy of the tree rather than at the tree it is being run from.
 */
export const packageRoot = (url) =>
  process.env.ICARUS_PACKAGE_ROOT ?? resolve(dirname(fileURLToPath(url)), "..", "..", "..");
export const libRoot = (url) => join(packageRoot(url), "src", "lib");

/** @returns {{ positional: string[], flags: Set<string> }} */
export const invocation = () => {
  const given = process.argv.slice(2).filter((argument, index) => !(index === 0 && argument === "--"));
  return {
    positional: given.filter((argument) => !argument.startsWith("--")),
    flags: new Set(given.filter((argument) => argument.startsWith("--")).map((flag) => flag.slice(2)))
  };
};

/** Stops with the usage line rather than generating something nobody asked for. */
export const usage = (line, detail = "") => {
  console.error(`usage: ${line}`);
  if (detail) console.error(`\n${detail}`);
  process.exit(1);
};

export const requireKebab = (value, what, line) => {
  if (!value) usage(line);
  if (!KEBAB.test(value)) usage(line, `'${value}' is not a kebab-case ${what}.`);
  return value;
};

/** A directory name is kebab-case; the names built from it are not. */
export const pascal = (name) => name.replace(/(^|-)([a-z0-9])/g, (_, __, character) => character.toUpperCase());
export const camel = (name) => name.replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase());
export const constant = (name) => name.replace(/-/g, "_").toUpperCase();
