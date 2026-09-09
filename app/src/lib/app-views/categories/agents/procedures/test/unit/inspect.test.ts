import { describe, expect, it } from "vitest";

import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

const recorder = () => {
  const asked: { key: string; selection: unknown }[] = [];
  const view = {
    inspect: (key: string, selection: unknown) => asked.push({ key, selection })
  } as unknown as WorkspaceStateModel;
  return { asked, view };
};

/**
 * A lens drawn over the wrong kind of selection is the one way this category
 * can show a blank panel, so the pairing is asserted rather than assumed.
 */
describe("inspectAgent", () => {
  it("pairs each lens with a selection of its own kind", () => {
    const { asked, view } = recorder();

    inspectAgent(view, { kind: "persona", id: "personas:1" });
    inspectAgent(view, { kind: "task", id: "agentTasks:2" });
    inspectAgent(view, { kind: "automation", id: "automations:3" });
    inspectAgent(view, { kind: "activity", id: "activity:4" });

    expect(asked).toEqual([
      { key: "agents.persona", selection: { kind: "persona", id: "personas:1" } },
      { key: "agents.task", selection: { kind: "task", id: "agentTasks:2" } },
      { key: "agents.automation", selection: { kind: "automation", id: "automations:3" } },
      { key: "agents.activity", selection: { kind: "activity", id: "activity:4" } }
    ]);
  });

  it("carries the owner a tool is granted on, so the lens can offer the toggle", () => {
    const { asked, view } = recorder();

    inspectAgent(view, { kind: "tool", id: "retrieve", at: "personas:1" });

    expect(asked).toEqual([
      { key: "agents.tool", selection: { kind: "tool", id: "retrieve", at: "personas:1" } }
    ]);
  });
});
