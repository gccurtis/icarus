import { afterEach, expect, test, vi } from "vitest";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state";
import { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";
import { createResource } from "$app-views/categories/new-tab/procedures/create-resource";
import { useTemplate } from "$app-views/categories/new-tab/procedures/use-template";
import { openInspectedResource } from "$app-views/categories/project-overview/procedures/open-inspected-resource";
import type { LibraryTemplate } from "$app-views/categories/templates/procedures/library-types";

const commands = vi.hoisted(() => ({
  create: vi.fn(),
  chat: vi.fn(),
  template: vi.fn()
}));
vi.mock("$app-views/categories/new-tab/procedures/creating", () => ({
  createProjectResource: commands.create
}));
vi.mock("$app-views/categories/project-overview/procedures/create-chat", () => ({
  createChat: commands.chat
}));
vi.mock("$app-views/categories/new-tab/procedures/instantiate-template", () => ({
  instantiateLauncherTemplate: commands.template
}));

const workspace = () => createWorkspaceState(
  "project",
  createTabList(),
  createTabViews(),
  { afterOps: 0, afterMs: 0 }
);
const template: LibraryTemplate = {
  id: "templates:1", name: "Brief", description: "", makes: "Document",
  scope: "Project", tags: [], holeCount: 0, createdBy: "Person",
  revision: 1, updatedAt: 0, updated: "now", lastUsedAt: null,
  canEdit: true, canDelete: true
};

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

test.each([
  ["document", "documents:one", "document-editor"],
  ["presentation", "presentations:one", "presentation-editor"],
  ["spreadsheet", "spreadsheets:one", "spreadsheet-editor"],
  ["research", "researchThreads:one", "research"]
] as const)("the inspected %s opens its real resource and consumes the launcher", (kind, id, category) => {
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  openInspectedResource(view, { kind, id });
  expect(view.active.category).toBe(category);
  expect(view.active.resourceId).toBe(id);
  expect(view.tabs.some((tab) => tab.id === origin.id)).toBe(false);
});

test("Open finding alerts without opening a placeholder or consuming the launcher", () => {
  const alert = vi.fn();
  vi.stubGlobal("alert", alert);
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  view.inspect("project-overview.resource", { kind: "finding", id: "findings:one" });
  openInspectedResource(view, { kind: "finding", id: "findings:one" });
  expect(alert).toHaveBeenCalledWith("Opening a finding in its own view is not wired up yet.");
  expect(view.activeId).toBe(origin.id);
  expect(view.selection).toEqual({ kind: "finding", id: "findings:one" });
});

test("failed creation retains its launcher, clears pending state and permits retry", async () => {
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  const state = new LauncherState();
  commands.create.mockRejectedValueOnce(new Error("Storage unavailable"));
  await createResource(view, state, "document");
  expect(view.activeId).toBe(origin.id);
  expect(state.pending).toBeUndefined();
  expect(state.error).toBe("Storage unavailable");

  commands.create.mockResolvedValueOnce({ resourceId: "documents:new" });
  await createResource(view, state, "document");
  expect(view.active.resourceId).toBe("documents:new");
  expect(view.tabs.some((tab) => tab.id === origin.id)).toBe(false);
  expect(state.error).toBeUndefined();
});

test("switching away and back cannot revive an unmounted creation command", async () => {
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  const state = new LauncherState();
  const response = Promise.withResolvers<{ resourceId: string }>();
  commands.create.mockReturnValueOnce(response.promise);
  const work = createResource(view, state, "document");
  view.activate("project-overview");
  state.dispose();
  view.activate(origin.id);
  response.resolve({ resourceId: "documents:late" });
  await work;
  expect(view.activeId).toBe(origin.id);
  expect(view.tabs.some((tab) => tab.resourceId === "documents:late")).toBe(false);
});

test("a pending creation cannot consume a newer launcher or start duplicate work", async () => {
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  const state = new LauncherState();
  const response = Promise.withResolvers<{ resourceId: string }>();
  commands.create.mockReturnValueOnce(response.promise);
  const work = createResource(view, state, "document");
  await createResource(view, state, "spreadsheet");
  expect(commands.create).toHaveBeenCalledTimes(1);
  const newer = view.open({ category: "new-tab" });
  response.resolve({ resourceId: "documents:late" });
  await work;
  expect(view.activeId).toBe(newer.id);
  expect(view.tabs.some((tab) => tab.id === origin.id)).toBe(true);
  expect(view.tabs.some((tab) => tab.resourceId === "documents:late")).toBe(false);
});

test("research creation opens the represented chat and consumes its launcher", async () => {
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  commands.chat.mockResolvedValueOnce("researchThreads:new");
  await createResource(view, new LauncherState(), "research");
  expect(view.active.category).toBe("research");
  expect(view.active.resourceId).toBe("researchThreads:new");
  expect(view.tabs.some((tab) => tab.id === origin.id)).toBe(false);
});

test("a refused template preserves the launcher and its actionable explanation", async () => {
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  const state = new LauncherState();
  commands.template.mockResolvedValueOnce({ accepted: false, detail: "Subject line needs words" });
  await useTemplate(view, state, template);
  expect(view.activeId).toBe(origin.id);
  expect(state.error).toBe("Subject line needs words");
  expect(state.errorFocus).toBe(template.id);
  expect(state.pending).toBeUndefined();
});

test("a spreadsheet template alerts without starting work or consuming its launcher", async () => {
  const alert = vi.fn();
  vi.stubGlobal("alert", alert);
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  await useTemplate(view, new LauncherState(), { ...template, makes: "Spreadsheet" });
  expect(alert).toHaveBeenCalledWith("Creating from a spreadsheet template is not wired up yet.");
  expect(commands.template).not.toHaveBeenCalled();
  expect(view.activeId).toBe(origin.id);
});

test("one launcher admits only one durable command across independent surfaces", async () => {
  const view = workspace();
  view.open({ category: "new-tab" });
  const creationState = new LauncherState();
  const templateState = new LauncherState();
  const response = Promise.withResolvers<{ resourceId: string }>();
  commands.create.mockReturnValueOnce(response.promise);

  const creation = createResource(view, creationState, "document");
  await useTemplate(view, templateState, template);

  expect(commands.template).not.toHaveBeenCalled();
  expect(templateState.error).toBe("Another New Tab action is already in progress.");
  response.resolve({ resourceId: "documents:only" });
  await creation;
  expect(view.active.resourceId).toBe("documents:only");
});

test("the same creation in two New Tabs remains independently owned", async () => {
  const view = workspace();
  const firstTab = view.open({ category: "new-tab" });
  const firstResponse = Promise.withResolvers<{ resourceId: string }>();
  const secondResponse = Promise.withResolvers<{ resourceId: string }>();
  commands.create
    .mockReturnValueOnce(firstResponse.promise)
    .mockReturnValueOnce(secondResponse.promise);

  const first = createResource(view, new LauncherState(), "document");
  const secondTab = view.open({ category: "new-tab" });
  const second = createResource(view, new LauncherState(), "document");
  await Promise.resolve();
  expect(commands.create).toHaveBeenCalledTimes(2);

  firstResponse.resolve({ resourceId: "documents:first" });
  await first;
  expect(view.activeId).toBe(secondTab.id);
  secondResponse.resolve({ resourceId: "documents:second" });
  await second;
  expect(view.active.resourceId).toBe("documents:second");
  expect(view.tabs.some((tab) => tab.id === firstTab.id)).toBe(true);
});

test("a template finishing after tab navigation does not redirect the new selection", async () => {
  const view = workspace();
  const origin = view.open({ category: "new-tab" });
  const state = new LauncherState();
  const response = Promise.withResolvers<unknown>();
  commands.template.mockReturnValueOnce(response.promise);
  const work = useTemplate(view, state, template);
  view.activate("project-overview");
  response.resolve({ accepted: true, target: "document", resourceId: "documents:from-template" });
  await work;
  expect(view.activeId).toBe("project-overview");
  expect(view.tabs.some((tab) => tab.id === origin.id)).toBe(true);
});
