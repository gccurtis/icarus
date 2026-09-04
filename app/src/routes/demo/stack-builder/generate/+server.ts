import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { error, json } from "@sveltejs/kit";

import {
  isSafeName,
  isSafeSourcePath
} from "$development-views/stack-builder/procedures/admission.server";
import {
  appendLog,
  mockDocument,
  readLog,
  readMock,
  readSource,
  stylesText,
  writeMock
} from "$development-views/stack-builder/procedures/log.server";
import { buildMessages } from "$development-views/stack-builder/procedures/prompt.server";
import type { MockRecord, StackNode } from "$development-views/stack-builder/types";

import type { RequestHandler } from "./$types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const bodyOf = (html: string): string =>
  html.includes("<body>") ? html.replace(/^[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*$/, "") : "";

const fenceless = (content: string): string =>
  content
    .replace(/^\s*```(?:html)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const key = env.OPENROUTER_API_KEY;
  if (!key) error(500, "OPENROUTER_API_KEY is not set — check .env and kit.env.dir");

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { slug, title, nodes, model, feedback, sources, theme } = body as Record<string, unknown>;
  if (!isSafeName(slug)) error(400, "a file name is lower-case words joined by hyphens");
  if (typeof title !== "string" || !title.trim()) error(400, "a stack carries a title");
  if (!Array.isArray(nodes) || nodes.length === 0) error(400, "the stack is empty");
  if (typeof model !== "string" || !model.includes("/")) error(400, "a model id names a provider");
  if (!Array.isArray(sources)) error(400, "sources is an array");

  const asked = sources as { name?: unknown; path?: unknown }[];
  for (const source of asked) {
    if (!isSafeSourcePath(source.path)) error(400, `refused source path: ${String(source.path)}`);
  }

  const brief = await stylesText();
  const read = await Promise.all(
    asked.map(async (source) => ({
      name: String(source.name),
      path: source.path as string,
      text: await readSource(source.path as string)
    }))
  );

  const said = typeof feedback === "string" ? feedback.trim() : "";
  const previous = said ? bodyOf((await readMock()) ?? "") : "";

  const { system, user } = buildMessages({
    title: title.trim(),
    nodes: nodes as StackNode[],
    brief,
    sources: read,
    ...(said && previous ? { previous, feedback: said } : {})
  });

  const answer = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!answer.ok) {
    error(502, `${model} refused it (${answer.status}): ${(await answer.text()).slice(0, 400)}`);
  }

  const payload = (await answer.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) error(502, `${model} returned no content`);

  const wanted = theme === "cyberpunk" ? "cyberpunk" : "celestial";
  await writeMock(mockDocument(brief, wanted, fenceless(content)));

  const records = await readLog(slug);
  const record: MockRecord = {
    at: new Date().toISOString(),
    kind: "mock",
    revision: records.filter((held) => held.kind === "manifest").length,
    model,
    feedback: said
  };
  await appendLog(slug, record);

  return json(record, { status: 201 });
};
