import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";
import type { ContentBlock } from "$content/types/block";
import { messagesRefusal, MessagesError } from "$messages/errors";
import { message, messageValidator, type MessageFields } from "$messages/types/message";

const blocks: ContentBlock[] = [
  {
    id: "b1",
    type: "text",
    variant: "paragraph",
    atoms: [{ id: "a1", kind: "literal", text: "What did Q3 look like?" }],
    display: "What did Q3 look like?",
    marks: []
  }
];

const prompt: MessageFields = {
  id: "m1",
  role: "prompt",
  author: { kind: "user", id: "u1" },
  sentAt: 1_755_388_800_000,
  blocks
};

const response: MessageFields = { id: "m2", role: "response", sentAt: 1_755_388_800_001, blocks };

describe("message", () => {
  describe("a prompt must name its author", () => {
    it("throws when a prompt has none", () => {
      // Absence means "the thread's own responder", which a prompt has no case
      // for — an unauthored one is a question from nobody, with no way to
      // attribute it or reply.
      const { author, ...unauthored } = prompt;

      expect(author).toEqual({ kind: "user", id: "u1" });
      expect(() => message(unauthored)).toThrow(MessagesError);
    });

    it("throws a refusal a client can read off the wire", () => {
      // The class does not survive the wire; Convex serializes the payload. A
      // plain Error would reach the author as an opaque server fault.
      const { author, ...unauthored } = prompt;
      expect(author).toBeDefined();

      let caught: unknown;
      try {
        message(unauthored);
      } catch (error) {
        caught = error;
      }

      expect(messagesRefusal(caught)).toEqual({
        capability: "messages",
        code: "prompt-unauthored",
        message: expect.any(String)
      });
    });

    it("allows a response with no author, meaning the obvious responder", () => {
      // A persona answering in its own chat, a task reporting in its own thread.
      expect(message(response).author).toBeUndefined();
    });

    it("keeps an author on a response when it is someone else", () => {
      const other = message({ ...response, author: { kind: "persona", id: "p1" } });
      expect(other.author).toEqual({ kind: "persona", id: "p1" });
    });
  });

  describe("state is derived from error, never supplied", () => {
    it("is complete when nothing failed and nothing is arriving", () => {
      expect(message(prompt).state).toBe("complete");
    });

    it("is streaming while a turn is still arriving", () => {
      expect(message({ ...response, streaming: true }).state).toBe("streaming");
    });

    it("is error whenever an error is present", () => {
      expect(message({ ...response, error: "model timed out" }).state).toBe("error");
    });

    it("lets an error win over streaming, because the failure already happened", () => {
      expect(message({ ...response, streaming: true, error: "model timed out" }).state).toBe(
        "error"
      );
    });

    it("carries the blocks either way, because a turn that failed still said something", () => {
      expect(message({ ...response, error: "model timed out" }).blocks).toEqual(blocks);
    });

    it("takes no state from the caller at all", () => {
      // Two fields saying whether the turn worked can disagree; one cannot. The
      // field does not exist on the input, so a contradicting state is unwritable
      // rather than merely rejected.
      expect(Object.keys(message(response))).toContain("state");
      // @ts-expect-error — `state` is not part of MessageFields, and that is the point.
      expect(message({ ...response, state: "streaming" }).state).toBe("complete");
    });
  });

  describe("labels", () => {
    it("trims and lowercases, so one idea is one label", () => {
      expect(message({ ...response, labels: ["  Pinned ", "NEEDS-REVIEW"] }).labels).toEqual([
        "pinned",
        "needs-review"
      ]);
    });

    it("stays absent when none were given", () => {
      expect(message(response).labels).toBeUndefined();
    });
  });

  it("omits an absent optional rather than storing an undefined", () => {
    expect(Object.keys(message(response)).sort()).toEqual([
      "blocks",
      "id",
      "role",
      "sentAt",
      "state"
    ]);
  });

  it("builds something the validator admits", () => {
    expect(validate(messageValidator, message(prompt))).toBe(true);
    expect(
      validate(
        messageValidator,
        message({ ...response, attachments: [{ kind: "external::web-page", id: "f1" }] })
      )
    ).toBe(true);
  });
});

describe("messageValidator", () => {
  it("carries no thread reference and no projectId", () => {
    // Both belonged to a table. The owner row is the thread, so the link stops
    // needing to exist rather than being stored more cheaply.
    for (const absent of ["thread", "threadId", "projectId", "chatId"]) {
      expect(Object.keys(messageValidator.fields)).not.toContain(absent);
    }
  });

  it("carries no tool calls and no extracted mentions", () => {
    // Tool calls are a client concern; a mention is a mark inside the blocks.
    for (const absent of ["toolCalls", "mentions", "sources"]) {
      expect(Object.keys(messageValidator.fields)).not.toContain(absent);
    }
  });

  it("orders by array position, so it needs no previous-message pointer", () => {
    expect(Object.keys(messageValidator.fields)).not.toContain("previousMessageId");
    expect(Object.keys(messageValidator.fields)).toContain("sentAt");
  });

  describe("what it refuses", () => {
    it("refuses a role that is not a side of the exchange", () => {
      // Not `user | assistant`: a thread is a room, and with three people and an
      // agent in it "user" would be four different actors wearing one label.
      expect(validate(messageValidator, { ...message(prompt), role: "assistant" })).toBe(false);
      expect(validate(messageValidator, { ...message(prompt), role: "user" })).toBe(false);
    });

    it("refuses a state it does not name", () => {
      expect(validate(messageValidator, { ...message(prompt), state: "pending" })).toBe(false);
    });

    it("refuses a turn with no sentAt", () => {
      const { sentAt, ...withoutSentAt } = message(prompt);
      expect(sentAt).toBeTypeOf("number");
      expect(validate(messageValidator, withoutSentAt)).toBe(false);
    });

    it("refuses an attachment that is not a resource ref", () => {
      // There is no link variant: a link lives in a mark, and capturing it
      // produces an external file, which is already a resource ref.
      expect(
        validate(messageValidator, {
          ...message(response),
          attachments: [{ kind: "link", url: "https://example.com", triedAt: 0, ok: true }]
        })
      ).toBe(false);
    });
  });
});
