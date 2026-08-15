import { existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkStyles, cssFacts } from "../../lint/styles/rules.mjs";

export const packageRoot = process.env.ICARUS_PACKAGE_ROOT ?? dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
export const stylesRoot = join(packageRoot, "src", "lib", "styles");
export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const die = (message) => {
  console.error(message);
  process.exit(1);
};

export const validateName = (name, kind) => {
  if (!name || !KEBAB.test(name) || name === "default" || name === "generated") {
    die(`${kind} name must be non-reserved kebab-case`);
  }
};

export const parseArgs = (argv) => {
  const positional = [];
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) positional.push(value);
    else {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) die(`missing value for ${value}`);
      options.set(value.slice(2), next);
      index += 1;
    }
  }
  return { positional, options };
};

export const transaction = () => {
  const writes = [];
  return {
    create(path, contents) {
      if (existsSync(path)) die(`${relative(packageRoot, path)} already exists; nothing was written`);
      writes.push({ path, contents, existed: false, previous: null });
    },
    edit(path, contents) {
      if (!existsSync(path)) die(`${relative(packageRoot, path)} does not exist; nothing was written`);
      writes.push({ path, contents, existed: true, previous: readFileSync(path, "utf8") });
    },
    commit() {
      const applied = [];
      const failAfter = Number(process.env.ICARUS_STYLE_FAIL_AFTER ?? 0);
      try {
        for (const write of writes) {
          mkdirSync(dirname(write.path), { recursive: true });
          writeFileSync(write.path, write.contents);
          applied.push(write);
          if (failAfter > 0 && applied.length === failAfter) throw new Error("simulated write failure");
        }
        const failures = checkStyles({ packageRoot, stylesRoot });
        if (failures.length > 0) {
          const summary = failures.slice(0, 8).map((failure) => `${failure.path}:${failure.line} ${failure.rule} ${failure.message}`).join("\n");
          throw new Error(`generated result violates the style contract:\n${summary}`);
        }
      } catch (error) {
        for (const write of applied.reverse()) {
          if (write.existed) writeFileSync(write.path, write.previous);
          else {
            rmSync(write.path, { force: true });
            try { rmdirSync(dirname(write.path)); } catch { /* parent is shared or non-empty */ }
          }
        }
        throw error;
      }
      return writes.map(({ path }) => relative(packageRoot, path));
    }
  };
};

const localImports = (app) => cssFacts(app).imports.filter(({ specifier }) => specifier?.startsWith(".")).map(({ specifier }) => specifier);

export const registerImport = ({ specifier }) => {
  const app = join(stylesRoot, "app.css");
  let text = readFileSync(app, "utf8");
  if (text.includes(`@import "${specifier}";`)) die(`${specifier} is already registered`);
  const candidates = localImports(app).filter((item) => /^\.\/chromatic-themes\/[^/]+\/[^/]+\.css$/.test(item));
  const sentinel = "./chromatic-themes/slots.css";
  const defaultImport = candidates[0];
  const ordered = [defaultImport, ...[...candidates.slice(1), specifier].sort()].filter(Boolean);
  for (const item of candidates) text = text.replace(`@import "${item}";\n`, "");
  const marker = `@import "${sentinel}";`;
  text = text.replace(marker, `${ordered.map((item) => `@import "${item}";`).join("\n")}\n${marker}`);
  return text;
};

export const updateInventory = ({ path, start, end, header, row, key }) => {
  const text = readFileSync(path, "utf8");
  const pattern = new RegExp(`(${start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n)([\\s\\S]*?)(\\n${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`);
  const match = text.match(pattern);
  if (!match) die(`generated inventory markers are missing from ${relative(packageRoot, path)}`);
  const rows = match[2].split("\n").filter((line) => line.startsWith("| `"));
  rows.push(row);
  rows.sort((left, right) => {
    const leftDefault = /\| yes \|$/.test(left);
    const rightDefault = /\| yes \|$/.test(right);
    return leftDefault === rightDefault ? left.localeCompare(right) : leftDefault ? -1 : 1;
  });
  const body = `${header}\n${rows.join("\n")}`;
  return text.replace(pattern, `$1${body}$3`);
};

export const darkVariant = (names) => {
  const path = join(stylesRoot, "x-integrations", "tailwind", "tailwind.css");
  const text = readFileSync(path, "utf8");
  const selectors = names.flatMap((name) => [`[data-theme="${name}"]`, `[data-theme="${name}"] *`]).join(", ");
  return { path, contents: text.replace(/@custom-variant dark \([^;]+\);/, `@custom-variant dark (&:where(${selectors}));`) };
};

export const report = (name, paths) => console.log(`${name}:\n${paths.map((path) => `  ${path}`).join("\n")}`);
