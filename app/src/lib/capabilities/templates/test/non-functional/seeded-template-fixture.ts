import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, vi } from "vitest";

import {
  defineStore,
  type StoreModel
} from "$model/server/store/index.server";
import type { TemplateHole } from "$representation/data/types/templates/template";

const runtimeState = vi.hoisted(() => ({ store: undefined as unknown as StoreModel }));

export const runtime = runtimeState;

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: "default", userId: "default-user", username: "Ana Duarte" })
}));

export const { instantiateTemplate } = await import(
  "$capabilities/templates/api/instantiate-template/instantiate-template"
);
export const { removeTemplate } = await import(
  "$capabilities/templates/api/remove-template/remove-template"
);
export const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);

export type StoredRow = Record<string, unknown> & { readonly _id: string };
export type SeedTemplate = {
  readonly _id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly revision: number;
  readonly body: { readonly resource: "document" | "presentation" | "spreadsheet" };
  readonly holes: readonly TemplateHole[];
};
export type SeedTemplateVersion = {
  readonly _id: string;
  readonly templateId: string;
  readonly revision: number;
  readonly name: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly body: { readonly resource: "document" | "presentation" | "spreadsheet" };
  readonly holes: readonly TemplateHole[];
};

export const seedDirectory = dirname(
  fileURLToPath(new URL("../../../../../../seed/templates.json", import.meta.url))
);
export const seededTemplates = JSON.parse(
  readFileSync(join(seedDirectory, "templates.json"), "utf8")
) as readonly SeedTemplate[];
export const seededVersions = JSON.parse(
  readFileSync(join(seedDirectory, "templateVersions.json"), "utf8")
) as readonly SeedTemplateVersion[];
const directories: string[] = [];

export const storeFromCommittedSeed = (): StoreModel => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-seeded-template-"));
  directories.push(directory);
  for (const file of readdirSync(seedDirectory)) {
    if (!file.endsWith(".json")) continue;
    copyFileSync(join(seedDirectory, file), join(directory, file));
  }
  return defineStore({ directory, now: () => 1_790_000_000_000 });
};

export const rowsIn = (store: StoreModel, table: string): readonly StoredRow[] => {
  const answer = store.read(table);
  return answer?.kind === "table" ? (answer.rows as readonly StoredRow[]) : [];
};

export const rowIn = (store: StoreModel, table: string, id: string): StoredRow => {
  const row = rowsIn(store, table).find((candidate) => candidate._id === id);
  if (row === undefined) throw new Error(`The committed seed has no ${table}.${id}`);
  return row;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});
