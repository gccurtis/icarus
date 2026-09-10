import { describe, expect, it, vi } from "vitest";

import { createPickingChannel, type Picker } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";

describe("the project picking channel", () => {
  it("owns one stable session until its exact picker disarms", () => {
    const insert = vi.fn();
    const first: Picker = { insert };
    const other: Picker = { insert: vi.fn() };
    const channel = createPickingChannel();

    expect(channel.armed).toBe(false);
    expect(channel.session).toBe(0);

    channel.arm(first);
    expect(channel.armed).toBe(true);
    expect(channel.session).toBe(1);
    expect(channel.pick("E22", "r22/c5", 1)).toBe(true);
    expect(insert).toHaveBeenCalledWith("E22", "r22/c5", 1);

    channel.arm(first);
    channel.disarm(other);
    expect(channel.armed).toBe(true);
    expect(channel.session).toBe(1);

    channel.disarm(first);
    expect(channel.armed).toBe(false);
    expect(channel.pick("F22", "r22/c6", 2)).toBe(false);

    channel.arm(first);
    expect(channel.session).toBe(2);
  });

  it("buffers a fast opening-key burst until the writing field takes it", () => {
    const channel = createPickingChannel();

    channel.beginWriting("D");
    channel.beginWriting("u");
    channel.beginWriting("rable");

    expect(channel.begun).toEqual({ seed: "Durable", at: 3 });
    channel.writingTaken();
    expect(channel.begun).toBeUndefined();
  });
});
