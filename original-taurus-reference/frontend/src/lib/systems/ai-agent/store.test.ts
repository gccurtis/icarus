import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get, writable } from 'svelte/store';

// Mock workspace (subscribed at module load) and the toast used on error.
vi.mock('$data/workspace', () => ({ workspace: writable(null) }));
vi.mock('$lib/components', () => ({ toast: vi.fn() }));

// Mock the real Omega client so the store logic is tested in isolation.
const apiFns = vi.hoisted(() => ({
  listChats: vi.fn(),
  createChat: vi.fn(),
  getChat: vi.fn(),
  postTurn: vi.fn(),
  setChatPersona: vi.fn(),
  getTask: vi.fn(),
  acceptPlan: vi.fn()
}));
vi.mock('./api', () => apiFns);

import { workspace } from '$data/workspace';
import { aiAgent } from './store';
import { submitAiPrompt, setAiMode, setAiPersona, loadChats } from './actions';

const projectWs = (projectId: string, activeTabId = 'overview') => ({
  projectId,
  tabs: [{ id: 'overview', title: 'Overview', closeable: false }],
  activeTabId,
  context: { width: 220, collapsed: false, section: 'properties' },
  inspector: { width: 220, collapsed: false, section: 'details' }
});

const reply = (userBody: string, agentBody: string, taskId?: string) => ({
  userMessage: { id: `u-${userBody}`, author: 'user' as const, body: userBody },
  agentMessage: { id: `a-${agentBody}`, author: 'agent' as const, body: agentBody, taskId },
  usage: { promptTokens: 0, totalTokens: 0 }
});

beforeEach(() => {
  vi.clearAllMocks();
  workspace.set(null);
});

describe('aiAgent store', () => {
  describe('project isolation', () => {
    it('resets to fresh state when the project changes', async () => {
      workspace.set(projectWs('proj-a'));
      apiFns.createChat.mockResolvedValue({ id: 'c1', title: 'Hi', mode: 'ask', updatedAt: '' });
      apiFns.postTurn.mockResolvedValue(reply('Hi', 'Hello'));
      await submitAiPrompt('Hi', 'ask');
      expect(get(aiAgent).chats.length).toBe(1);
      expect(get(aiAgent).messages.length).toBe(2);

      workspace.set(projectWs('proj-b'));
      const s = get(aiAgent);
      expect(s.chats.length).toBe(0);
      expect(s.messages.length).toBe(0);
      expect(s.activeChatId).toBeNull();
    });

    it('does not reset within the same project', () => {
      workspace.set(projectWs('proj-c'));
      setAiMode('plan');
      workspace.set(projectWs('proj-c', 'tab-1'));
      expect(get(aiAgent).mode).toBe('plan');
    });
  });

  describe('submitAiPrompt', () => {
    beforeEach(() => workspace.set(projectWs('proj-d')));

    it('ignores empty prompts', async () => {
      await submitAiPrompt('   ', 'ask');
      expect(apiFns.createChat).not.toHaveBeenCalled();
      expect(get(aiAgent).messages.length).toBe(0);
    });

    it('creates a chat then posts a turn, appending user + agent messages', async () => {
      apiFns.createChat.mockResolvedValue({ id: 'c1', title: 'Q', mode: 'ask', updatedAt: '' });
      apiFns.postTurn.mockResolvedValue(reply('Q', 'A'));
      await submitAiPrompt('Q', 'ask');
      expect(apiFns.createChat).toHaveBeenCalledWith('ask', undefined, 'Q');
      expect(apiFns.postTurn).toHaveBeenCalledWith('c1', 'Q', false);
      const s = get(aiAgent);
      expect(s.view).toBe('conversation');
      expect(s.activeChatId).toBe('c1');
      expect(s.messages.map((m) => m.body)).toEqual(['Q', 'A']);
      expect(s.sending).toBe(false);
    });

    it('reuses the active chat when the mode matches', async () => {
      apiFns.createChat.mockResolvedValue({ id: 'c1', title: 'Q', mode: 'ask', updatedAt: '' });
      apiFns.postTurn.mockResolvedValue(reply('Q', 'A'));
      await submitAiPrompt('Q', 'ask');
      apiFns.createChat.mockClear();
      apiFns.postTurn.mockResolvedValue(reply('More', 'OK'));
      await submitAiPrompt('More', 'ask');
      expect(apiFns.createChat).not.toHaveBeenCalled();
      expect(get(aiAgent).messages.map((m) => m.body)).toEqual(['Q', 'A', 'More', 'OK']);
    });

    it('opens a fresh chat when the mode differs from the active chat', async () => {
      apiFns.createChat.mockResolvedValueOnce({ id: 'c1', title: 'Q', mode: 'ask', updatedAt: '' });
      apiFns.postTurn.mockResolvedValueOnce(reply('Q', 'A'));
      await submitAiPrompt('Q', 'ask');
      apiFns.createChat.mockResolvedValueOnce({ id: 'c2', title: 'Plan it', mode: 'plan', updatedAt: '' });
      apiFns.postTurn.mockResolvedValueOnce(reply('Plan it', 'Drafting', 'task-9'));
      await submitAiPrompt('Plan it', 'plan');
      expect(apiFns.createChat).toHaveBeenCalledTimes(2);
      expect(get(aiAgent).activeChatId).toBe('c2');
      expect(get(aiAgent).messages.map((m) => m.body)).toEqual(['Plan it', 'Drafting']);
    });

    it('clears the optimistic message and sending flag on error', async () => {
      apiFns.createChat.mockRejectedValue({ status: 500, message: 'boom' });
      await submitAiPrompt('Q', 'ask');
      const s = get(aiAgent);
      expect(s.sending).toBe(false);
      expect(s.messages.length).toBe(0);
    });
  });

  describe('loadChats', () => {
    beforeEach(() => workspace.set(projectWs('proj-e')));

    it('loads the project chats into the list', async () => {
      apiFns.listChats.mockResolvedValue([{ id: 'c9', title: 'X', mode: 'ask', updatedAt: '' }]);
      await loadChats();
      expect(get(aiAgent).chats.length).toBe(1);
      expect(get(aiAgent).status).toBe('ready');
    });
  });

  describe('per-chat persona', () => {
    beforeEach(() => workspace.set(projectWs('proj-persona')));

    it('applies a pending non-default persona to the new chat before the turn', async () => {
      apiFns.createChat.mockResolvedValue({ id: 'c1', title: 'Q', mode: 'ask', updatedAt: '' });
      apiFns.setChatPersona.mockResolvedValue({
        id: 'c1',
        title: 'Q',
        mode: 'ask',
        personaId: 'editor',
        updatedAt: ''
      });
      apiFns.postTurn.mockResolvedValue(reply('Q', 'A'));
      aiAgent.update((s) => ({ ...s, personaId: 'editor', defaultPersonaId: 'general' }));
      await submitAiPrompt('Q', 'ask');
      expect(apiFns.setChatPersona).toHaveBeenCalledWith('c1', 'editor');
      expect(get(aiAgent).chats[0].personaId).toBe('editor');
    });

    it('does not PATCH when the pending persona equals the default', async () => {
      apiFns.createChat.mockResolvedValue({ id: 'c2', title: 'Q', mode: 'ask', updatedAt: '' });
      apiFns.postTurn.mockResolvedValue(reply('Q', 'A'));
      aiAgent.update((s) => ({ ...s, personaId: 'general', defaultPersonaId: 'general' }));
      await submitAiPrompt('Q', 'ask');
      expect(apiFns.setChatPersona).not.toHaveBeenCalled();
    });

    it('PATCHes the open chat persona via setAiPersona', async () => {
      apiFns.createChat.mockResolvedValue({ id: 'c3', title: 'Q', mode: 'ask', updatedAt: '' });
      apiFns.postTurn.mockResolvedValue(reply('Q', 'A'));
      aiAgent.update((s) => ({ ...s, personaId: 'general', defaultPersonaId: 'general' }));
      await submitAiPrompt('Q', 'ask');
      apiFns.setChatPersona.mockResolvedValue({
        id: 'c3',
        title: 'Q',
        mode: 'ask',
        personaId: 'editor',
        updatedAt: ''
      });
      await setAiPersona('editor');
      expect(apiFns.setChatPersona).toHaveBeenCalledWith('c3', 'editor');
      expect(get(aiAgent).personaId).toBe('editor');
    });
  });
});
