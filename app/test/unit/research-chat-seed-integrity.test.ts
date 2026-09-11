import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { isStoredResearchTurn } from "$representation/data/behavior/investigation/stored-rows";

type SeedThread = {
  readonly _id: string;
  readonly projectId: string;
  readonly kind: string;
};

type SeedResearchThread = {
  readonly _id: string;
  readonly projectId: string;
  readonly threadId: string;
  readonly findingIds: readonly string[];
};

type SeedMessage = {
  readonly id: string;
  readonly role: "prompt" | "response";
  readonly blocks: readonly unknown[];
};

type SeedThreadPart = {
  readonly _id: string;
  readonly projectId: string;
  readonly threadId: string;
  readonly messages: readonly SeedMessage[];
};

type SeedSource = {
  readonly id: string;
  readonly ref: { readonly kind: "document" | "presentation" | "spreadsheet"; readonly id: string };
  readonly title: string;
  readonly excerpt: string;
  readonly uses: readonly string[];
};

type SeedTurn = {
  readonly _id: string;
  readonly projectId: string;
  readonly researchThreadId: string;
  readonly threadId: string;
  readonly promptMessageId: string;
  readonly messageId?: string;
  readonly prompt: string;
  readonly state: "running" | "answered" | "insufficient" | "failed" | "cancelled";
  readonly blocks: readonly unknown[];
  readonly sources: readonly SeedSource[];
  readonly findings: readonly { readonly id: string; readonly text: string; readonly sourceIds: readonly string[] }[];
};

type SeedFinding = { readonly _id: string; readonly researchThreadIds: readonly string[] };
type SeedActivity = { readonly _id: string; readonly target: { readonly kind: string; readonly id: string } };
type SeedResource = { readonly _id: string; readonly projectId: string; readonly title: string };
type SeedSnapshot = {
  readonly projectId: string;
  readonly resourceId: string;
  readonly role: string;
  readonly body: unknown;
};
type SeedCell = {
  readonly projectId: string;
  readonly resourceId: string;
  readonly value?: { readonly kind: string; readonly value?: unknown };
};

const fixture = <Value>(name: string): Value =>
  JSON.parse(readFileSync(resolve(process.cwd(), "seed", name), "utf8")) as Value;

const normalized = (value: string): string => value.replace(/\s+/g, " ").trim();

const messageText = (message: SeedMessage): string => {
  const displays: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.display === "string") displays.push(record.display);
    for (const [key, child] of Object.entries(record)) {
      if (key !== "display") visit(child);
    }
  };
  visit(message.blocks);
  return normalized(displays.join(" "));
};

const displayedEvidence = (value: unknown): string => {
  const displays: string[] = [];
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const entry of candidate) visit(entry);
      return;
    }
    if (candidate === null || typeof candidate !== "object") return;
    const record = candidate as Record<string, unknown>;
    if (typeof record.display === "string") displays.push(record.display);
    for (const [key, child] of Object.entries(record)) {
      if (key !== "display") visit(child);
    }
  };
  visit(value);
  return normalized(displays.join(" "));
};

describe("committed research-chat records", () => {
  const threads = fixture<SeedThread[]>("threads.json");
  const researchThreads = fixture<SeedResearchThread[]>("researchThreads.json");
  const parts = fixture<SeedThreadPart[]>("threadParts.json");
  const turns = fixture<SeedTurn[]>("researchTurns.json");

  test("every committed turn is exactly the current lifecycle schema", () => {
    expect(turns.every(isStoredResearchTurn)).toBe(true);
  });

  test("every chat has one real base thread, persisted messages and one turn per prompt", () => {
    const baseById = new Map(threads.map((row) => [row._id, row]));
    const researchById = new Map(researchThreads.map((row) => [row._id, row]));
    const researchByThreadId = new Map(researchThreads.map((row) => [row.threadId, row]));
    const partsByThread = new Map<string, SeedThreadPart[]>();
    for (const part of parts) {
      const held = partsByThread.get(part.threadId) ?? [];
      held.push(part);
      partsByThread.set(part.threadId, held);
    }

    expect(
      threads.filter((row) => row.kind === "researchThread").map((row) => row._id).sort()
    ).toEqual([...researchByThreadId.keys()].sort());

    for (const chat of researchThreads) {
      const base = baseById.get(chat.threadId);
      expect(base, `${chat._id} points at a missing base thread`).toBeDefined();
      expect(base?.kind, `${chat._id} points at the wrong thread kind`).toBe("researchThread");
      expect(base?.projectId, `${chat._id} crosses projects`).toBe(chat.projectId);

      const chatParts = partsByThread.get(chat.threadId) ?? [];
      expect(chatParts.length, `${chat._id} has no persisted thread part`).toBeGreaterThan(0);
      expect(chatParts.every((part) => part.projectId === chat.projectId)).toBe(true);

      const messages = chatParts.flatMap((part) => part.messages);
      const messageIds = new Set(messages.map((message) => message.id));
      expect(messageIds.size, `${chat._id} repeats a message id`).toBe(messages.length);
      const chatTurns = turns.filter((turn) => turn.researchThreadId === chat._id);
      expect(chatTurns.length, `${chat._id} has messages but no research turn`).toBeGreaterThan(0);
      expect(chatTurns.map((turn) => turn.promptMessageId).sort()).toEqual(
        messages.filter((message) => message.role === "prompt").map((message) => message.id).sort()
      );
      expect(chatTurns.flatMap((turn) => turn.messageId ?? []).sort()).toEqual(
        messages.filter((message) => message.role === "response").map((message) => message.id).sort()
      );
    }

    for (const turn of turns) {
      const chat = researchById.get(turn.researchThreadId);
      expect(chat, `${turn._id} points at a missing research thread`).toBeDefined();
      expect(turn.threadId, `${turn._id} names a different base thread`).toBe(chat?.threadId);
      expect(turn.projectId, `${turn._id} crosses projects`).toBe(chat?.projectId);
      expect(["answered", "insufficient", "failed", "cancelled"]).toContain(turn.state);

      const messages = (partsByThread.get(turn.threadId) ?? []).flatMap((part) => part.messages);
      const prompt = messages.find((message) => message.id === turn.promptMessageId);
      expect(prompt?.role, `${turn._id} has no prompt message`).toBe("prompt");
      expect(messageText(prompt!), `${turn._id} prompt text drifted from its message`).toBe(
        normalized(turn.prompt)
      );

      if (turn.state === "answered" || turn.state === "insufficient") {
        const response = messages.find((message) => message.id === turn.messageId);
        expect(response?.role, `${turn._id} has no response message`).toBe("response");
        expect(response?.blocks, `${turn._id} response blocks drifted from its message`).toEqual(
          turn.blocks
        );
      } else {
        expect(turn.messageId, `${turn._id} claims a response after ${turn.state}`).toBeUndefined();
        expect(turn.blocks, `${turn._id} carries answer blocks after ${turn.state}`).toEqual([]);
      }
    }
  });

  test("every citation resolves to exact committed evidence and every finding cites its own turn", () => {
    const resources = [
      ...fixture<SeedResource[]>("documents.json").map((row) => ({ ...row, kind: "document" as const })),
      ...fixture<SeedResource[]>("presentations.json").map((row) => ({ ...row, kind: "presentation" as const })),
      ...fixture<SeedResource[]>("spreadsheets.json").map((row) => ({ ...row, kind: "spreadsheet" as const }))
    ];
    const resourceByKey = new Map(resources.map((row) => [`${row.kind}:${row._id}`, row]));
    const evidenceByKey = new Map<string, string>();

    for (const [kind, name] of [
      ["document", "documentSnapshots.json"],
      ["presentation", "presentationSnapshots.json"]
    ] as const) {
      for (const snapshot of fixture<SeedSnapshot[]>(name).filter((row) => row.role === "leader")) {
        evidenceByKey.set(`${kind}:${snapshot.resourceId}`, displayedEvidence(snapshot.body));
      }
    }

    const cells = fixture<SeedCell[]>("sheetCells.json");
    for (const sheet of fixture<SeedResource[]>("spreadsheets.json")) {
      const text = cells
        .filter((cell) => cell.projectId === sheet.projectId && cell.resourceId === sheet._id)
        .flatMap((cell) =>
          cell.value?.value === undefined ? [] : [String(cell.value.value)]
        );
      evidenceByKey.set(`spreadsheet:${sheet._id}`, normalized(text.join(" ")));
    }

    for (const turn of turns) {
      const sourceIds = new Set(turn.sources.map((source) => source.id));
      expect(sourceIds.size, `${turn._id} repeats a source id`).toBe(turn.sources.length);
      if (turn.state === "answered") {
        expect(turn.sources.length, `${turn._id} is answered without committed evidence`).toBeGreaterThan(0);
      }
      if (turn.state === "insufficient") {
        expect(turn.sources, `${turn._id} is insufficient but claims sources`).toEqual([]);
        expect(turn.findings, `${turn._id} is insufficient but claims findings`).toEqual([]);
      }

      for (const source of turn.sources) {
        const key = `${source.ref.kind}:${source.ref.id}`;
        const resource = resourceByKey.get(key);
        expect(resource, `${turn._id}/${source.id} points at a missing resource`).toBeDefined();
        expect(resource?.projectId, `${turn._id}/${source.id} crosses projects`).toBe(turn.projectId);
        expect(source.title, `${turn._id}/${source.id} has a fabricated title`).toBe(resource?.title);
        expect(source.uses.length, `${turn._id}/${source.id} does not say how it was used`).toBeGreaterThan(0);
        expect(
          evidenceByKey.get(key),
          `${turn._id}/${source.id} has no committed leader evidence`
        ).toContain(normalized(source.excerpt));
      }

      for (const finding of turn.findings) {
        expect(finding.text.trim(), `${turn._id}/${finding.id} is blank`).not.toBe("");
        expect(finding.sourceIds.length, `${turn._id}/${finding.id} cites nothing`).toBeGreaterThan(0);
        expect(
          finding.sourceIds.every((sourceId) => sourceIds.has(sourceId)),
          `${turn._id}/${finding.id} cites a source outside its turn`
        ).toBe(true);
      }
    }
  });

  test("secondary seed references cannot point at removed research chats", () => {
    const ids = new Set(researchThreads.map((row) => row._id));
    for (const finding of fixture<SeedFinding[]>("findings.json")) {
      expect(
        finding.researchThreadIds.every((id) => ids.has(id)),
        `${finding._id} points at a missing research thread`
      ).toBe(true);
    }
    for (const activity of fixture<SeedActivity[]>("activity.json")) {
      if (activity.target.kind !== "research") continue;
      expect(ids.has(activity.target.id), `${activity._id} points at a missing research thread`).toBe(true);
    }
  });
});
