import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import type { LogRecord } from "$development-views/stack-builder/types";

const root = process.cwd().endsWith(`${sep}app`) ? resolve(process.cwd(), "..") : process.cwd();
const LOGS = join(root, "logs", "stack-builder");
const MOCKS = join(LOGS, "mocks");

const STYLES = [
  "material/ramps.css",
  "material/helios/helios.css",
  "material/selene/selene.css",
  "material/slots.css",
  "tokens/color.css",
  "tokens/typography.css",
  "tokens/space.css",
  "tokens/shape.css",
  "tokens/motion.css",
  "surfaces/surfaces.css"
];

export const logPath = (slug: string): string => join(LOGS, `${slug}.jsonl`);

export const mockPath = (): string => join(LOGS, "mock.html");

export const readLog = async (slug: string): Promise<LogRecord[]> => {
  const path = logPath(slug);
  if (!existsSync(path)) return [];

  const raw = await readFile(path, "utf8");

  return raw.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as LogRecord];
    } catch {
      return [];
    }
  });
};

export const appendLog = async (slug: string, record: LogRecord): Promise<void> => {
  await mkdir(LOGS, { recursive: true });
  await appendFile(logPath(slug), `${JSON.stringify(record)}\n`, "utf8");
};

export const readMock = async (): Promise<string | undefined> =>
  existsSync(mockPath()) ? readFile(mockPath(), "utf8") : undefined;

export const writeMock = async (html: string): Promise<void> => {
  await mkdir(LOGS, { recursive: true });
  await writeFile(mockPath(), html, "utf8");
};

export const saveMock = async (name: string): Promise<string> => {
  const held = await readMock();
  if (held === undefined) throw new Error("there is no mock to save");
  await mkdir(MOCKS, { recursive: true });
  await writeFile(join(MOCKS, `${name}.html`), held, "utf8");
  return `mocks/${name}.html`;
};

export const readSource = async (path: string): Promise<string> =>
  readFile(join(process.cwd(), path), "utf8");

export const stylesText = async (): Promise<string> => {
  const base = join(process.cwd(), "src", "lib", "styles");
  const parts = await Promise.all(STYLES.map((name) => readFile(join(base, name), "utf8")));
  return parts.join("\n");
};

export const mockDocument = (css: string, appearance: string, body: string): string =>
  `<!doctype html>\n<html lang="en" data-appearance="${appearance}">\n<head><meta charset="utf-8"><style>${css}</style></head>\n<body>${body}</body>\n</html>\n`;
