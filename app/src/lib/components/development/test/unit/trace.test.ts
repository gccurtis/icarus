import { describe, expect, it } from "vitest";
import { render } from "svelte/server";

import TracedPanel from "$development-components/test/unit/traced-panel.svelte";
import { createTrace, type TraceNode } from "$development-components/trace.svelte";

/**
 * A run seeded through context, rendered, and handed back.
 *
 * **Reading `body` is what runs the component.** Svelte's server `render`
 * returns lazy getters, so a test that renders and then reads the tree without
 * touching the output asserts against a tree nothing has filled yet.
 */
const traced = (component: typeof TracedPanel) => {
  const run = createTrace();
  const output = render(component, {
    context: new Map([[Symbol.for("icarus.trace"), run.root]])
  });
  return { run, body: output.body };
};

/** Every name in the tree, depth first, so a shape can be asserted flat. */
const names = (node: TraceNode): string[] => [node.name, ...node.children.flatMap(names)];

describe("a run records what a panel is made of", () => {
  it("registers the primitives a panel rendered", () => {
    const { run } = traced(TracedPanel);

    const found = names(run.root);
    expect(found[0]).toBe("root");
    expect(found).toContain("Panel");
    expect(found).toContain("PanelField");
  });

  it("nests a field under the panel that drew it", () => {
    const { run } = traced(TracedPanel);

    const panel = run.root.children.find((child) => child.name === "Panel");
    expect(panel).toBeDefined();
    expect(names(panel as TraceNode)).toContain("PanelField");
  });

  it("reads props at display time rather than at registration", () => {
    const { run } = traced(TracedPanel);

    const panel = run.root.children.find((child) => child.name === "Panel");
    expect(panel?.props().title).toBe("Mira Jain");
  });

  it("marks the DOM, so a name on the right can find what it drew on the left", () => {
    const { run, body } = traced(TracedPanel);

    const panel = run.root.children.find((child) => child.name === "Panel");
    expect(body).toContain(`data-trace="${panel?.id}"`);
  });

  it("records nothing, and marks nothing, when no one is watching", () => {
    const { body } = render(TracedPanel);
    expect(body).not.toContain("data-trace");
  });
});
