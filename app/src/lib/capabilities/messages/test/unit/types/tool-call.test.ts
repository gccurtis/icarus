import { describe, expect, it } from "vitest";
import { toolCallValidator } from "$messages/types/tool-call";

describe("toolCallValidator", () => {
  it("records what a call was, how it went, and how long it took", () => {
    expect(Object.keys(toolCallValidator.fields).sort()).toEqual(
      ["name", "input", "output", "state", "error", "durationMs"].sort()
    );
  });

  it("leaves a tool's payload uninterpreted on both sides", () => {
    // Every tool's payload is different and the tool implementation is the only
    // thing that can read its own arguments.
    expect(toolCallValidator.fields.input.kind).toBe("any");
    expect(toolCallValidator.fields.output.kind).toBe("any");
  });

  it("distinguishes a call still running from one that failed", () => {
    const states = toolCallValidator.fields.state.members.map((member) => member.value);

    expect(states).toEqual(["pending", "success", "error"]);
  });
});
