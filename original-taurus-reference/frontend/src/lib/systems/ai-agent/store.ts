import { writable } from 'svelte/store';
import { workspace } from '$data/workspace';
import type { AiAgentState } from './types';

/**
 * AI Agent dock store — real Omega chats/turns/tasks (no mock seed). Actions in
 * `./actions` load and mutate it against the backend.
 *
 * Strict project isolation (design law, matches every project-scoped store):
 * all dock state resets whenever the active project changes, so one project's
 * conversations never bleed into another's.
 */
function freshState(): AiAgentState {
  return {
    mode: 'ask',
    view: 'chats',
    status: 'idle',
    error: null,
    chats: [],
    activeChatId: null,
    messages: [],
    sending: false,
    activeTask: null,
    contextSourceIds: ['document'],
    excludedContextItemIds: [],
    webEnabled: false,
    personas: [],
    personaId: null,
    defaultPersonaId: null,
    attachments: [],
    attachmentsUnavailable: false,
    activeResourceId: null,
    activeResourceKind: null
  };
}

export const aiAgent = writable<AiAgentState>(freshState());

// Reset all dock state on project switch (strict isolation). The bump also lets
// in-flight task polls notice the chat is gone and stop (they guard on activeChatId).
let watchedAi: string | null = null;
workspace.subscribe((ws) => {
  if (!ws) {
    watchedAi = null;
    return;
  }
  if (watchedAi !== ws.projectId) {
    watchedAi = ws.projectId;
    aiAgent.set(freshState());
  }
});
