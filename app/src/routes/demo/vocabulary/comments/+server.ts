import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { dev } from "$app/environment";
import { error, json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

/**
 * The review log behind `/demo/vocabulary`.
 *
 * The vocabulary page is read in one sitting and argued with a row at a time, so
 * the notes have to land somewhere durable the moment they are typed — a comment
 * held in the browser is one refresh away from gone, and a comment that has to
 * be copied out by hand does not get written.
 *
 * **Append-only, one JSON object per line.** Appending is the only write that
 * cannot lose an earlier note, and a line is the smallest unit that survives the
 * file being opened and edited by hand while the page is still up. A line that
 * no longer parses is skipped on read rather than fatal, for the same reason.
 *
 * **Development only.** It writes to the checkout, which is a thing a running
 * deployment must never do, so in production both verbs are simply absent.
 */
const LIMIT = 4000;

/**
 * The repository root, not the package. `pnpm dev` runs from `app/`, but the log
 * belongs beside the other work-in-progress records rather than inside the
 * frontend package.
 */
const root = process.cwd().endsWith(`${sep}app`) ? resolve(process.cwd(), "..") : process.cwd();
const LOG = join(root, "logs", "vocabulary-comments.jsonl");

type Comment = {
  /** When the server wrote it. The client never stamps: two clocks would disagree. */
  at: string;
  /** `<scope>/<slug>` — which row on the page the note is about. */
  id: string;
  /** That row's label, so the log reads without the page beside it. */
  label: string;
  text: string;
};

const read = async (): Promise<Comment[]> => {
  if (!existsSync(LOG)) return [];

  const raw = await readFile(LOG, "utf8");

  return raw.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as Comment];
    } catch {
      return [];
    }
  });
};

export const GET: RequestHandler = async () => {
  if (!dev) return new Response("not found", { status: 404 });

  return json({ path: LOG, comments: await read() });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { id, label, text } = body as Record<string, unknown>;
  if (typeof id !== "string" || !id.trim()) error(400, "a note names the row it is about");
  if (typeof label !== "string") error(400, "a note carries its row's label");
  if (typeof text !== "string" || !text.trim()) error(400, "an empty note is not a note");
  if (text.length > LIMIT) error(413, `a note is at most ${LIMIT} characters`);

  const comment: Comment = { at: new Date().toISOString(), id, label, text: text.trim() };

  await mkdir(dirname(LOG), { recursive: true });
  await appendFile(LOG, `${JSON.stringify(comment)}\n`, "utf8");

  return json(comment, { status: 201 });
};
