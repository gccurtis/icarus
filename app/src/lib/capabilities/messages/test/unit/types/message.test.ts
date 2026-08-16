import { describe, expect, it } from "vitest";
import type { Id } from "$convex/_generated/dataModel";
import { messagesRefusal } from "$messages/errors";
import { messageAuthor, messageRoleValidator, messageStateValidator } from "$messages/types/message";
import type { Actor } from "$shared/types/actor";

const asker: Actor = { kind: "user", userId: "users:1" as unknown as Id<"users"> };

describe("messageRoleValidator", () => {
  it("says which side of the exchange a turn is on, not who took it", () => {
    const roles = messageRoleValidator.members.map((member) => member.value);

    expect(roles).toEqual(["prompt", "response"]);
  });

  it("refuses user and assistant, because a thread is a room", () => {
    const roles = messageRoleValidator.members.map((member) => member.value);

    // With three people and an agent in one thread, "user" would be four
    // different actors wearing one label. Identity is `author`.
    expect(roles).not.toContain("user");
    expect(roles).not.toContain("assistant");
  });
});

describe("messageStateValidator", () => {
  it("keeps a turn that died on the way distinguishable from one still arriving", () => {
    const states = messageStateValidator.members.map((member) => member.value);

    expect(states).toEqual(["streaming", "complete", "error"]);
  });
});

describe("messageAuthor", () => {
  it("requires an author on a prompt", () => {
    // A prompt has no obvious asker, so an unauthored one is a question from
    // nobody.
    let refusal;
    try {
      messageAuthor("prompt", undefined);
    } catch (error) {
      refusal = messagesRefusal(error);
    }

    expect(refusal).toMatchObject({ code: "prompt-unauthored" });
  });

  it("keeps the author a prompt names", () => {
    expect(messageAuthor("prompt", asker)).toBe(asker);
  });

  it("allows a response with none, which means the thread's own responder", () => {
    // A persona answering in its own chat, a task reporting in its own thread.
    expect(messageAuthor("response", undefined)).toBeUndefined();
  });

  it("keeps the author a response names, which is always somebody else", () => {
    expect(messageAuthor("response", asker)).toBe(asker);
  });
});
