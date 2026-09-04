import { dev } from "$app/environment";
import { error, json } from "@sveltejs/kit";

import { isSafeName } from "$development-views/stack-builder/procedures/admission.server";
import { appendLog, readLog } from "$development-views/stack-builder/procedures/log.server";
import type { ManifestRecord, StackNode } from "$development-views/stack-builder/types";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const slug = url.searchParams.get("slug") ?? "";
  if (!isSafeName(slug)) error(400, "a file name is lower-case words joined by hyphens");

  return json({ records: await readLog(slug) });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { slug, title, nodes } = body as Record<string, unknown>;
  if (!isSafeName(slug)) error(400, "a file name is lower-case words joined by hyphens");
  if (typeof title !== "string" || !title.trim()) error(400, "a stack carries a title");
  if (!Array.isArray(nodes)) error(400, "nodes is an array");

  const record: ManifestRecord = {
    at: new Date().toISOString(),
    kind: "manifest",
    title: title.trim(),
    nodes: nodes as StackNode[]
  };

  await appendLog(slug, record);

  return json(record, { status: 201 });
};
