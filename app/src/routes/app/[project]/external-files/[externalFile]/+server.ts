import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

import { readExternalFileContent } from "$capabilities/external-files";

const contentDisposition = (name: string): string => {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "download";
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, (value) =>
    `%${value.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

const rangeIn = (
  value: string | null,
  size: number
): { start: number; end: number } | null | "invalid" => {
  if (value === null) return null;
  if (size === 0) return "invalid";
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (match === null || (match[1] === "" && match[2] === "")) return "invalid";
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] === "" ? size - 1 : Number(match[2]);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= size
  ) {
    return "invalid";
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
};

export const GET: RequestHandler = async ({ params, request }) => {
  const result = await readExternalFileContent({ externalFileId: params.externalFile });
  if (result === null) error(404, "No such external file");
  const etag = `"sha256-${result.hash}"`;
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "private, no-cache",
    "content-disposition": contentDisposition(result.name),
    "content-security-policy": "default-src 'none'; sandbox",
    "content-type": result.mediaType,
    etag,
    "x-content-type-options": "nosniff"
  });
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const range = rangeIn(request.headers.get("range"), result.bytes.byteLength);
  if (range === "invalid") {
    headers.set("content-range", `bytes */${result.bytes.byteLength}`);
    return new Response(null, { status: 416, headers });
  }
  if (range === null) {
    headers.set("content-length", String(result.bytes.byteLength));
    return new Response(new Uint8Array(result.bytes).buffer, { status: 200, headers });
  }
  const bytes = result.bytes.slice(range.start, range.end + 1);
  headers.set("content-length", String(bytes.byteLength));
  headers.set("content-range", `bytes ${range.start}-${range.end}/${result.bytes.byteLength}`);
  return new Response(new Uint8Array(bytes).buffer, { status: 206, headers });
};
