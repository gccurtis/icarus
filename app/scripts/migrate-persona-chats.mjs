import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Folds `personaThreads` into `researchThreads`.
 *
 * A persona chat and a research chat became one thing, and the table one of them
 * lived in was removed. The store loads by table name, so a `personaThreads.json`
 * left on disk is not migrated, not read and not reported — the chats simply stop
 * existing. This turns them into research threads carrying their persona.
 *
 * Idempotent: a chat already present by id is left alone, and the source file is
 * renamed aside rather than deleted, so a bad run is recoverable.
 *
 *   node scripts/migrate-persona-chats.mjs [data directory]
 */
const directory = process.argv[2] ?? "data";
const read = (name) => {
  const path = join(directory, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
};
const write = (name, value) =>
  writeFileSync(join(directory, name), `${JSON.stringify(value, null, 2)}\n`);

const chats = read("personaThreads.json");
if (chats === undefined) {
  console.log(`No personaThreads.json under ${directory}; nothing to migrate.`);
  process.exit(0);
}
if (!Array.isArray(chats)) {
  console.error(`${directory}/personaThreads.json is not a list of rows.`);
  process.exit(1);
}

const research = read("researchThreads.json") ?? [];
const threads = read("threads.json") ?? [];
const known = new Set(research.map((row) => row._id));

const converted = chats.flatMap((row) => {
  const id = String(row._id ?? "").replace("personaThreads:", "researchThreads:");
  if (id === "" || known.has(id)) return [];
  return [
    {
      _id: id,
      _creationTime: row._creationTime ?? Date.now(),
      projectId: row.projectId,
      threadId: row.threadId,
      title: row.title ?? "Chat",
      mode: { kind: "explore" },
      ...(row.personaId === undefined ? {} : { personaId: row.personaId }),
      findingIds: [],
      createdBy: row.createdBy ?? { kind: "system" },
      updatedAt: row.updatedAt ?? row._creationTime ?? Date.now()
    }
  ];
});

let rekinded = 0;
for (const thread of threads) {
  if (thread.kind === "personaThread") {
    thread.kind = "researchThread";
    rekinded += 1;
  }
}

write("researchThreads.json", [...research, ...converted]);
if (threads.length > 0) write("threads.json", threads);
renameSync(join(directory, "personaThreads.json"), join(directory, "personaThreads.json.migrated"));

console.log(
  `Migrated ${converted.length} persona chat(s) into researchThreads, re-kinded ${rekinded} thread(s).`
);
console.log("The source file is kept as personaThreads.json.migrated.");
