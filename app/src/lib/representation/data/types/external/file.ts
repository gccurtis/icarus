import type { Id } from "$representation/data/types/core/id";

/**
 * What a file is, for routing — the subkind under `externalFile` or
 * `connection`. The base kind is the table, so it is never stored.
 *
 * `text` is anything you read words out of, parser or not: a markdown file and a
 * PDF differ to whoever writes the extractor and to nobody downstream. `data`
 * backs an analysis rather than a reading; `image` goes in a block.
 */
export type FileSubkind = "text" | "data" | "image" | "audio" | "video" | "unknown";

/**
 * Where the bytes came from. A union rather than a flag, because the cases carry
 * different data.
 *
 * An upload comes from a person — an agent has no source to upload from, and
 * what it can do is produce a file. A captured web page is a `capture` and a
 * `text` subkind; the URL is what makes it a web link.
 */
export type FileOrigin =
  | { kind: "upload" }
  | { kind: "generated"; agentTaskId: Id<"agentTasks"> }
  | { kind: "capture"; url: string; capturedAt: number };

/**
 * Whether words can be got out of this file.
 *
 * Required, and `no` is a real answer: optional would make "nothing to read
 * here" indistinguishable from "not attempted yet", and a scanned PDF would be
 * retried forever by something that cannot tell the two apart.
 */
export type Readability = "unknown" | "yes" | "no" | "error";

/** The stored bytes' dimensions, not what was handed over. */
export type Dimensions = { width: number; height: number };
