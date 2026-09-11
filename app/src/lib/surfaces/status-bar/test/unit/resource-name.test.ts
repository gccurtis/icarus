import { describe, expect, test } from "vitest";

import {
  kindOf,
  nameOf,
  type ResourceNames
} from "$surfaces/status-bar/procedures/resource-name";

const names = (): ResourceNames => ({
  resourcesReady: true,
  agentsReady: true,
  templatesReady: true,
  stagesReady: true,
  resources: { resources: [], unavailable: [] },
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
  templates: { templates: [], unavailable: [] },
  stages: {
    stages: [{
      stageId: "templateStages:1",
      templateId: "templates:1",
      templateName: "Current template",
      target: "presentation",
      resourceId: "presentations:1"
    }],
    unavailable: []
  }
});

describe("status subject identity", () => {
  test("names and classifies an explicit current template stage", () => {
    const held = names();
    expect(nameOf("presentations:1", held)).toBe("Template · Current template");
    expect(kindOf("presentations:1", held.resources, held.stages)).toBe("Presentation");
  });
});
