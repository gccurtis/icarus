import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { dev } from "$app/environment";
import { error, json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

const LIMIT = 4000;

const root = process.cwd().endsWith(`${sep}app`) ? resolve(process.cwd(), "..") : process.cwd();
const LOG = join(root, "logs", "agents-reference-notes.jsonl");

type Note = {
  at: string;
  page: string;
  id: string;
  label: string;
  text: string;
};

const read = async (): Promise<Note[]> => {
  if (!existsSync(LOG)) return [];
  const raw = await readFile(LOG, "utf8");
  return raw.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as Note];
    } catch {
      return [];
    }
  });
};

export const GET: RequestHandler = async () => {
  if (!dev) return new Response("not found", { status: 404 });
  return json({ path: LOG, notes: await read() });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { page, id, label, text } = body as Record<string, unknown>;
  if (typeof page !== "string" || !page.trim()) error(400, "a note names the page it is on");
  if (typeof id !== "string" || !id.trim()) error(400, "a note names the row it is about");
  if (typeof label !== "string") error(400, "a note carries its row's label");
  if (typeof text !== "string" || !text.trim()) error(400, "an empty note is not a note");
  if (text.length > LIMIT) error(413, `a note is at most ${LIMIT} characters`);

  const note: Note = { at: new Date().toISOString(), page, id, label, text: text.trim() };

  await mkdir(dirname(LOG), { recursive: true });
  await appendFile(LOG, `${JSON.stringify(note)}\n`, "utf8");

  return json(note, { status: 201 });
};
