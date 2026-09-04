import { dev } from "$app/environment";
import { error, json } from "@sveltejs/kit";

import { isSafeName } from "$development-views/stack-builder/procedures/admission.server";
import {
  mockDocument,
  readMock,
  saveMock,
  stylesText,
  writeMock
} from "$development-views/stack-builder/procedures/log.server";

import type { RequestHandler } from "./$types";

const THEMES = ["celestial", "cyberpunk"];

const themeIn = (url: URL): string => {
  const asked = url.searchParams.get("theme") ?? "celestial";
  return THEMES.includes(asked) ? asked : "celestial";
};

const EMPTY =
  '<p style="color: var(--token-ink-muted); font-family: var(--token-font-sans); padding: 2rem">Nothing generated yet.</p>';

export const GET: RequestHandler = async ({ url }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const theme = themeIn(url);
  const held = await readMock();
  const html = held ?? mockDocument(await stylesText(), theme, EMPTY);

  return new Response(html.replace(/data-theme="[a-z]+"/, `data-theme="${theme}"`), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
};

export const DELETE: RequestHandler = async ({ url }) => {
  if (!dev) return new Response("not found", { status: 404 });

  await writeMock(mockDocument(await stylesText(), themeIn(url), EMPTY));

  return json({ cleared: true });
};

export const POST: RequestHandler = async ({ request }) => {
  if (!dev) return new Response("not found", { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "expected a JSON object");

  const { name } = body as Record<string, unknown>;
  if (!isSafeName(name)) error(400, "a name is lower-case words joined by hyphens");

  const held = await readMock();
  if (held === undefined) error(409, "there is no mock to save yet");

  return json({ file: await saveMock(name) }, { status: 201 });
};
