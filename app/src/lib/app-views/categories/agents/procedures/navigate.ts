import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { NEW } from "$app-views/categories/agents/procedures/naming";

export const isSelected = (view: WorkspaceStateModel, kind: string, id: string): boolean =>
  view.selection?.kind === kind && view.selection.id === id;

export const showLibrary = (view: WorkspaceStateModel): void => {
  view.showContent("agents.library", undefined);
};

export const openPersona = (view: WorkspaceStateModel, personaId: string): void => {
  view.showContent("agents.persona", personaId);
};

export const openTask = (view: WorkspaceStateModel, taskId: string): void => {
  view.showContent("agents.task", taskId);
};

export const openAutomation = (view: WorkspaceStateModel, automationId: string): void => {
  view.showContent("agents.automation", automationId);
};

export const openNewTask = (view: WorkspaceStateModel, personaId?: string): void => {
  view.showContent("agents.task", personaId === undefined ? NEW : `${NEW}:${personaId}`);
};

/** A chat is another category, so this opens a tab rather than moving this one. */
export const openChat = (view: WorkspaceStateModel, chatId: string): void => {
  view.open({ category: "research", content: "research.thread", resourceId: chatId });
};
