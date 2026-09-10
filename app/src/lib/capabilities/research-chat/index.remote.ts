import { command, query } from "$app/server";

import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import { ask as askProcedure } from "$capabilities/research-chat/api/ask/ask";
import { createThread as createThreadProcedure } from "$capabilities/research-chat/api/create-thread/create-thread";
import { readThread as readThreadProcedure } from "$capabilities/research-chat/api/read-thread/read-thread";
import { readThreads as readThreadsProcedure } from "$capabilities/research-chat/api/read-threads/read-threads";
import { removeThread as removeThreadProcedure } from "$capabilities/research-chat/api/remove-thread/remove-thread";
import { setThreadPersona as setThreadPersonaProcedure } from "$capabilities/research-chat/api/set-thread-persona/set-thread-persona";
import { stopTurn as stopTurnProcedure } from "$capabilities/research-chat/api/stop-turn/stop-turn";

export const readThreads = query(readThreadsProcedure);
export const readThread = query("unchecked", readThreadProcedure);

export const createThread = command("unchecked", async (input) => {
  const result = await createThreadProcedure(input);
  await readThreads().refresh();
  await readProjectResourceIndex().refresh();
  return result;
});

export const ask = command("unchecked", async (input) => {
  const result = await askProcedure(input);
  await readThreads().refresh();
  await readThread({ threadId: result.threadId }).refresh();
  if (result.accepted) await readProjectResourceIndex().refresh();
  return result;
});

export const stopTurn = command("unchecked", stopTurnProcedure);

export const setThreadPersona = command("unchecked", async (input) => {
  const result = await setThreadPersonaProcedure(input);
  await readThreads().refresh();
  await readThread({ threadId: result.threadId }).refresh();
  if (result.accepted) await readProjectResourceIndex().refresh();
  return result;
});

export const removeThread = command("unchecked", async (input) => {
  const result = await removeThreadProcedure(input);
  await readThreads().refresh();
  if (result.accepted) await readProjectResourceIndex().refresh();
  return result;
});

export type {
  AskInput,
  AskResult,
  CreateThreadInput,
  CreateThreadResult,
  ReadThreadInput,
  ReadThreadResult,
  PersonaOption,
  ReadThreadsResult,
  RemoveThreadInput,
  RemoveThreadResult,
  ResourceOption,
  SetThreadPersonaInput,
  StopTurnInput,
  StopTurnResult,
  ThreadItem,
  TurnItem
} from "$capabilities/research-chat/types/research-chat";
