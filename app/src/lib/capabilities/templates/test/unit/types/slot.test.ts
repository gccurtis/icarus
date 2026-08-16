import { describe, expect, it } from "vitest";
import { templatesRefusal } from "$templates/errors";
import { templateSlotValidator, templateSlots, type TemplateSlot } from "$templates/types/slot";

const text = (key: string): TemplateSlot => ({ key, label: "Client name", kind: "text" });

/** The payload, never the message: only the payload survives the wire. */
const refusalFrom = (call: () => unknown) => {
  try {
    call();
    return undefined;
  } catch (error) {
    return templatesRefusal(error);
  }
};

describe("templateSlotValidator", () => {
  it("admits every kind of hole the model defines", () => {
    const kinds = templateSlotValidator.fields.kind.members.map((member) => member.value).sort();

    expect(kinds).toEqual(["data", "derived", "image", "text"]);
  });

  it("requires a key and a label, and nothing else", () => {
    const optional = Object.entries(templateSlotValidator.fields)
      .filter(([, validator]) => validator.isOptional === "optional")
      .map(([name]) => name)
      .sort();

    expect(optional).toEqual(["default", "prompt", "required"]);
  });
});

describe("templateSlots", () => {
  it("keeps the slots it was given when every one is well formed", () => {
    const slots = [text("client_name"), { key: "logo", label: "Logo", kind: "image" as const }];

    expect(templateSlots(slots)).toEqual(slots);
  });

  it("refuses two slots claiming one key", () => {
    expect(refusalFrom(() => templateSlots([text("client_name"), text("client_name")]))).toMatchObject(
      { code: "duplicate-slot-key" }
    );
  });

  it("refuses a derived slot with nothing to generate from", () => {
    const slots: TemplateSlot[] = [{ key: "summary", label: "Summary", kind: "derived" }];

    expect(refusalFrom(() => templateSlots(slots))).toMatchObject({ code: "slot-prompt" });
  });

  it("refuses a prompt on a slot a person fills in", () => {
    const slots: TemplateSlot[] = [
      { key: "client_name", label: "Client name", kind: "text", prompt: "Who is this for?" }
    ];

    expect(refusalFrom(() => templateSlots(slots))).toMatchObject({ code: "slot-prompt" });
  });

  it("carries the prompt a derived slot generates from", () => {
    const slots: TemplateSlot[] = [
      { key: "summary", label: "Summary", kind: "derived", prompt: "Summarize the findings" }
    ];

    expect(templateSlots(slots)[0].prompt).toBe("Summarize the findings");
  });
});
