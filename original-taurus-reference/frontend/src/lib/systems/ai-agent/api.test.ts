import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.fn();
vi.mock('$data/api', () => ({ api: (path: string, init?: RequestInit) => apiMock(path, init) }));

import {
  listChats,
  createChat,
  getChat,
  postTurn,
  setChatPersona,
  getTask,
  acceptPlan,
  toAiTask,
  listPersonas,
  getDefaultPersona,
  setDefaultPersona,
  listAttachments,
  addFileAttachment,
  addDirectoryAttachment,
  deleteAttachment
} from './api';

beforeEach(() => apiMock.mockReset());

describe('chat client', () => {
  it('lists chats and maps them', async () => {
    apiMock.mockResolvedValue({
      chats: [{ id: 'c1', title: 'T', mode: 'ask', resourceId: 'r1', updatedAt: '2026-07-26' }]
    });
    const chats = await listChats('r1');
    expect(apiMock).toHaveBeenCalledWith('/agent/chats?resourceId=r1', undefined);
    expect(chats[0]).toEqual({ id: 'c1', title: 'T', mode: 'ask', resourceId: 'r1', updatedAt: '2026-07-26' });
  });

  it('omits the resource filter when none is given', async () => {
    apiMock.mockResolvedValue({ chats: [] });
    await listChats();
    expect(apiMock).toHaveBeenCalledWith('/agent/chats', undefined);
  });

  it('creates a chat with mode + resource in the body', async () => {
    apiMock.mockResolvedValue({ id: 'c2', title: '', mode: 'plan', updatedAt: '' });
    const chat = await createChat('plan', 'r9', 'Draft');
    expect(apiMock).toHaveBeenCalledWith('/agent/chats', {
      method: 'POST',
      body: JSON.stringify({ mode: 'plan', resourceId: 'r9', title: 'Draft' })
    });
    expect(chat.mode).toBe('plan');
    expect(chat.title).toBe('Untitled chat'); // blank title falls back
  });

  it('maps a chat + turns on get, roles → authors', async () => {
    apiMock.mockResolvedValue({
      chat: { id: 'c1', title: 'T', mode: 'ask', updatedAt: '' },
      turns: [
        { id: 't1', role: 'user', body: 'hi' },
        { id: 't2', role: 'agent', body: 'hello', taskId: 'task-1' }
      ]
    });
    const { chat, messages } = await getChat('c1');
    expect(chat.id).toBe('c1');
    expect(messages[0]).toEqual({ id: 't1', author: 'user', body: 'hi', taskId: undefined });
    expect(messages[1]).toEqual({ id: 't2', author: 'agent', body: 'hello', taskId: 'task-1' });
  });

  it('posts a turn with message + web and maps the result', async () => {
    apiMock.mockResolvedValue({
      userTurn: { id: 'u', role: 'user', body: 'go' },
      agentTurn: { id: 'a', role: 'agent', body: 'done', taskId: 'tk' },
      usage: { promptTokens: 3, totalTokens: 9 }
    });
    const result = await postTurn('c1', 'go', true);
    expect(apiMock).toHaveBeenCalledWith('/agent/chats/c1/turns', {
      method: 'POST',
      body: JSON.stringify({ message: 'go', web: true })
    });
    expect(result.userMessage.author).toBe('user');
    expect(result.agentMessage.taskId).toBe('tk');
    expect(result.usage).toEqual({ promptTokens: 3, totalTokens: 9 });
  });

  it('maps a chat personaId (empty → undefined)', async () => {
    apiMock.mockResolvedValueOnce({
      chats: [{ id: 'c1', title: 'T', mode: 'ask', personaId: 'editor', updatedAt: '' }]
    });
    expect((await listChats())[0].personaId).toBe('editor');
    apiMock.mockResolvedValueOnce({ chats: [{ id: 'c2', title: 'T', mode: 'ask', updatedAt: '' }] });
    expect((await listChats())[0].personaId).toBeUndefined();
  });

  it('sets a chat persona via PATCH and maps the returned chat', async () => {
    apiMock.mockResolvedValue({
      chat: { id: 'c1', title: 'T', mode: 'ask', personaId: 'editor', updatedAt: '' },
      turns: []
    });
    const chat = await setChatPersona('c1', 'editor');
    expect(apiMock).toHaveBeenCalledWith('/agent/chats/c1/persona', {
      method: 'PATCH',
      body: JSON.stringify({ personaId: 'editor' })
    });
    expect(chat.personaId).toBe('editor');
  });
});

describe('task client', () => {
  it('maps a task: state, persona, todos, plan draft, failure', () => {
    const task = toAiTask({
      id: 'tk',
      mode: 'plan',
      state: 'running',
      objective: 'Do the thing',
      persona: { name: 'General' },
      workspace: { todos: [{ id: 'd1', text: 'step', state: 'doing', detail: 'x' }] },
      plans: [
        { id: 'p0', state: 'superseded', draft: { title: 'old' } },
        {
          id: 'p1',
          state: 'draft',
          draft: { title: 'Plan', summary: 'sum', steps: [{ id: 's1', title: 'One', description: 'd' }] }
        }
      ],
      runs: [{ failure: 'boom' }],
      updatedAt: '2026-07-26'
    });
    expect(task.state).toBe('running');
    expect(task.personaName).toBe('General');
    expect(task.todos).toEqual([{ id: 'd1', text: 'step', state: 'doing', detail: 'x' }]);
    expect(task.plan?.revisionId).toBe('p1'); // latest revision wins
    expect(task.plan?.steps[0].title).toBe('One');
    expect(task.plan?.accepted).toBe(false);
    expect(task.failure).toBe('boom');
  });

  it('fetches a task by id', async () => {
    apiMock.mockResolvedValue({ id: 'tk', mode: 'action', state: 'completed', objective: 'x', updatedAt: '' });
    const task = await getTask('tk');
    expect(apiMock).toHaveBeenCalledWith('/agent/tasks/tk', undefined);
    expect(task.state).toBe('completed');
    expect(task.mode).toBe('action');
  });

  it('accepts a plan revision on the accept route', async () => {
    apiMock.mockResolvedValue({ id: 'tk', mode: 'plan', state: 'running', objective: 'x', updatedAt: '' });
    await acceptPlan('tk', 'p1');
    expect(apiMock).toHaveBeenCalledWith('/agent/tasks/tk/plans/p1/accept', { method: 'POST' });
  });
});

describe('persona client', () => {
  it('lists personas, unwrapping the { persona, version } Record shape', async () => {
    apiMock.mockResolvedValue({
      personas: [
        { persona: { id: 'general', name: 'General', description: 'gen' }, version: { version: 1 } },
        { persona: { id: 'p2', name: 'Editor', description: 'ed' } }
      ]
    });
    const personas = await listPersonas();
    expect(apiMock).toHaveBeenCalledWith('/personas', undefined);
    expect(personas).toEqual([
      { id: 'general', name: 'General', description: 'gen' },
      { id: 'p2', name: 'Editor', description: 'ed' }
    ]);
  });

  it('reads the default persona (a single unwrapped Record)', async () => {
    apiMock.mockResolvedValue({ persona: { id: 'general', name: 'General', description: 'gen' } });
    const persona = await getDefaultPersona();
    expect(apiMock).toHaveBeenCalledWith('/personas/default', undefined);
    expect(persona).toEqual({ id: 'general', name: 'General', description: 'gen' });
  });

  it('sets the default persona via PUT with the personaId body', async () => {
    apiMock.mockResolvedValue({ persona: { id: 'p2', name: 'Editor', description: 'ed' } });
    const persona = await setDefaultPersona('p2');
    expect(apiMock).toHaveBeenCalledWith('/personas/default', {
      method: 'PUT',
      body: JSON.stringify({ personaId: 'p2' })
    });
    expect(persona.id).toBe('p2');
  });
});

describe('attachment client', () => {
  it('lists a chat’s attachments, normalizing kind', async () => {
    apiMock.mockResolvedValue({ attachments: [{ id: 'a1', name: 'f.txt', kind: 'file' }] });
    const list = await listAttachments('c1');
    expect(apiMock).toHaveBeenCalledWith('/agent/chats/c1/attachments', undefined);
    expect(list).toEqual([{ id: 'a1', name: 'f.txt', kind: 'file', relativePath: undefined }]);
  });

  it('uploads a single file at the top level of the body', async () => {
    apiMock.mockResolvedValue({ id: 'a2', name: 'n.md', kind: 'file' });
    const a = await addFileAttachment('c1', { name: 'n.md', contentType: 'text/markdown', content: 'YQ==' });
    expect(apiMock).toHaveBeenCalledWith('/agent/chats/c1/attachments', {
      method: 'POST',
      body: JSON.stringify({ name: 'n.md', contentType: 'text/markdown', content: 'YQ==' })
    });
    expect(a.id).toBe('a2');
  });

  it('uploads a directory under the directory key', async () => {
    apiMock.mockResolvedValue({
      attachments: [{ id: 'a3', name: 'x', kind: 'directory', relativePath: 'd/x' }]
    });
    const list = await addDirectoryAttachment('c1', [
      { relativePath: 'd/x', name: 'x', contentType: 'text/plain', content: 'YQ==' }
    ]);
    expect(apiMock).toHaveBeenCalledWith('/agent/chats/c1/attachments', {
      method: 'POST',
      body: JSON.stringify({
        directory: [{ relativePath: 'd/x', name: 'x', contentType: 'text/plain', content: 'YQ==' }]
      })
    });
    expect(list[0]).toEqual({ id: 'a3', name: 'x', kind: 'directory', relativePath: 'd/x' });
  });

  it('deletes an attachment on the nested route', async () => {
    apiMock.mockResolvedValue(undefined);
    await deleteAttachment('c1', 'a1');
    expect(apiMock).toHaveBeenCalledWith('/agent/chats/c1/attachments/a1', { method: 'DELETE' });
  });
});
