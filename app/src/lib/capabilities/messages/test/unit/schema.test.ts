import { describe, expect, it } from "vitest";
import { blockValidator } from "$content/types/block";
import { messagesTables } from "$messages/schema";
import { messageSourceValidator } from "$messages/types/source";
import { threadRefValidator } from "$messages/types/thread";
import { toolCallValidator } from "$messages/types/tool-call";

/**
 * One table serves all three thread kinds, and the schema is where that is
 * either true or quietly abandoned: a second table, or a thread id column,
 * would put a conversation object back into a design that deliberately has
 * none.
 */
describe("messages schema", () => {
  it("declares one table and no conversation object beside it", () => {
    // A research thread, an agent task, and a persona thread each *are*
    // threads. There is nothing left for a `chats` row to hold.
    expect(Object.keys(messagesTables)).toEqual(["messages"]);
  });

  it("leads every index with projectId", () => {
    const indexes = messagesTables.messages[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("reads a thread by its discriminant and its id", () => {
    const indexes = messagesTables.messages[" indexes"]();
    const byThread = indexes.find((index) => index.indexDescriptor === "by_thread");

    // The consumer's own `_id` is the key, so the link is the index and there
    // is no field on either side to keep in sync.
    expect(byThread?.fields).toEqual(["projectId", "thread.kind", "thread.id"]);
  });

  it("holds the turn, who took it, and what it drew on", () => {
    const fields = Object.keys(messagesTables.messages.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "thread",
        "role",
        "blocks",
        "author",
        "mentions",
        "toolCalls",
        "sources",
        "state",
        "error"
      ].sort()
    );
  });

  it("names the thread it belongs to rather than pointing at a conversation", () => {
    const fields = messagesTables.messages.validator.fields;

    expect(fields.thread).toBe(threadRefValidator);
    expect(fields).not.toHaveProperty("chatId");
    expect(fields).not.toHaveProperty("threadId");
  });

  it("stores what was said as content blocks rather than markdown", () => {
    // A markdown string would mean parsing on every render, and would make a
    // citation inexpressible.
    expect(messagesTables.messages.validator.fields.blocks.element).toBe(blockValidator);
  });

  it("records the work behind a turn as tool calls and nothing else", () => {
    const fields = messagesTables.messages.validator.fields;

    // Research is an agent with a fixed toolset, and a search *is* a tool call.
    // `steps` was the same record described twice.
    expect(fields.toolCalls.element).toBe(toolCallValidator);
    expect(fields).not.toHaveProperty("steps");
  });

  it("carries its own sources, each naming where it came from", () => {
    expect(messagesTables.messages.validator.fields.sources.element).toBe(messageSourceValidator);
  });

  it("keeps ordering and history off the row, because appends are the only writes", () => {
    const fields = messagesTables.messages.validator.fields;

    // Order is `_creationTime`; changing a conversation is branching, which
    // leaves the original intact and needs nothing recorded here.
    expect(fields).not.toHaveProperty("rank");
    expect(fields).not.toHaveProperty("order");
    expect(fields).not.toHaveProperty("revision");
    expect(fields).not.toHaveProperty("editedAt");
  });
});
