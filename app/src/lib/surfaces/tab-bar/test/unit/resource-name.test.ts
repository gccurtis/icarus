import { describe, expect, test } from "vitest";

import { nameOf, type ResourceNames } from "$surfaces/tab-bar/procedures/resource-name";

const names = (ready = true): ResourceNames => ({
  ready,
  resources: {
    resources: [{
      id: "documents:1",
      kind: "document",
      name: "Durable title that must not win",
      updatedAt: 1,
      updatedByName: "Uma"
    }],
    unavailable: []
  },
  agents: {
    personas: [],
    tasks: [],
    automations: [],
    chats: [],
    activity: [],
    tools: [],
    resources: [],
    resourceSets: []
  },
  stages: {
    stages: [{
      stageId: "templateStages:1",
      templateId: "templates:1",
      templateName: "Current template",
      target: "document",
      resourceId: "documents:1"
    }],
    unavailable: []
  }
});

describe("tab subject names", () => {
  test("uses explicit current stage membership before listable resources", () => {
    expect(nameOf("documents:1", names())).toBe("Template · Current template");
  });

  test("distinguishes loading from a disconnected subject", () => {
    expect(nameOf("documents:1", names(false))).toBe("…");
    expect(nameOf("documents:missing", names())).toBe("Disconnected");
  });
});
