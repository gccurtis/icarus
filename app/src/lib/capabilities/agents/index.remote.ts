import { command, query } from "$app/server";

import { answerTaskQuestion as answerTaskQuestionProcedure } from "$capabilities/agents/api/answer-task-question/answer-task-question";
import { createAutomation as createAutomationProcedure } from "$capabilities/agents/api/create-automation/create-automation";
import { createChat as createChatProcedure } from "$capabilities/agents/api/create-chat/create-chat";
import { createPersona as createPersonaProcedure } from "$capabilities/agents/api/create-persona/create-persona";
import { createTask as createTaskProcedure } from "$capabilities/agents/api/create-task/create-task";
import { duplicatePersona as duplicatePersonaProcedure } from "$capabilities/agents/api/duplicate-persona/duplicate-persona";
import { readAgentsLibrary as readAgentsLibraryProcedure } from "$capabilities/agents/api/read-agents-library/read-agents-library";
import { readAutomation as readAutomationProcedure } from "$capabilities/agents/api/read-automation/read-automation";
import { readPersona as readPersonaProcedure } from "$capabilities/agents/api/read-persona/read-persona";
import { readTask as readTaskProcedure } from "$capabilities/agents/api/read-task/read-task";
import { removeAutomation as removeAutomationProcedure } from "$capabilities/agents/api/remove-automation/remove-automation";
import { removePersona as removePersonaProcedure } from "$capabilities/agents/api/remove-persona/remove-persona";
import { runAutomation as runAutomationProcedure } from "$capabilities/agents/api/run-automation/run-automation";
import { sendTaskMessage as sendTaskMessageProcedure } from "$capabilities/agents/api/send-task-message/send-task-message";
import { updateAutomation as updateAutomationProcedure } from "$capabilities/agents/api/update-automation/update-automation";
import { updatePersona as updatePersonaProcedure } from "$capabilities/agents/api/update-persona/update-persona";
import { updateTask as updateTaskProcedure } from "$capabilities/agents/api/update-task/update-task";

export const readAgentsLibrary = query(readAgentsLibraryProcedure);
export const readPersona = query("unchecked", readPersonaProcedure);
export const readTask = query("unchecked", readTaskProcedure);
export const readAutomation = query("unchecked", readAutomationProcedure);

export const createPersona = command("unchecked", async (input) => {
  const result = await createPersonaProcedure(input);
  await readAgentsLibrary().refresh();
  return result;
});

export const updatePersona = command("unchecked", async (input) => {
  const result = await updatePersonaProcedure(input);
  await readAgentsLibrary().refresh();
  await readPersona({ personaId: result.id }).refresh();
  return result;
});

export const duplicatePersona = command("unchecked", async (input) => {
  const result = await duplicatePersonaProcedure(input);
  await readAgentsLibrary().refresh();
  return result;
});

export const removePersona = command("unchecked", async (input) => {
  const result = await removePersonaProcedure(input);
  await readAgentsLibrary().refresh();
  await readPersona({ personaId: result.id }).refresh();
  return result;
});

export const createTask = command("unchecked", async (input) => {
  const result = await createTaskProcedure(input);
  await readAgentsLibrary().refresh();
  return result;
});

export const updateTask = command("unchecked", async (input) => {
  const result = await updateTaskProcedure(input);
  await readAgentsLibrary().refresh();
  await readTask({ taskId: result.id }).refresh();
  return result;
});

export const sendTaskMessage = command("unchecked", async (input) => {
  const result = await sendTaskMessageProcedure(input);
  await readTask({ taskId: result.id }).refresh();
  return result;
});

export const answerTaskQuestion = command("unchecked", async (input) => {
  const result = await answerTaskQuestionProcedure(input);
  await readAgentsLibrary().refresh();
  await readTask({ taskId: result.id }).refresh();
  return result;
});

export const createAutomation = command("unchecked", async (input) => {
  const result = await createAutomationProcedure(input);
  await readAgentsLibrary().refresh();
  return result;
});

export const updateAutomation = command("unchecked", async (input) => {
  const result = await updateAutomationProcedure(input);
  await readAgentsLibrary().refresh();
  await readAutomation({ automationId: result.id }).refresh();
  return result;
});

export const removeAutomation = command("unchecked", async (input) => {
  const result = await removeAutomationProcedure(input);
  await readAgentsLibrary().refresh();
  await readAutomation({ automationId: result.id }).refresh();
  return result;
});

export const runAutomation = command("unchecked", async (input) => {
  const result = await runAutomationProcedure(input);
  await readAgentsLibrary().refresh();
  await readAutomation({ automationId: result.id }).refresh();
  return result;
});

export const createChat = command("unchecked", async (input) => {
  const result = await createChatProcedure(input);
  await readAgentsLibrary().refresh();
  return result;
});

export type {
  Accepted,
  ActivityItem,
  AnswerTaskQuestionInput,
  AutomationDetail,
  AutomationItem,
  ChatItem,
  CreateAutomationInput,
  CreateChatInput,
  CreateChatResult,
  CreatePersonaInput,
  CreateTaskInput,
  DuplicatePersonaInput,
  PersonaCounts,
  PersonaDetail,
  PersonaItem,
  PersonaSectionName,
  ReadAgentsLibraryResult,
  ReadAutomationResult,
  ReadPersonaResult,
  ReadTaskResult,
  RefusalReason,
  Refused,
  RemoveAutomationInput,
  RemovePersonaInput,
  ResourceOption,
  ResourceSetOption,
  RunAutomationInput,
  RunAutomationResult,
  SendTaskMessageInput,
  TaskDetail,
  TaskItem,
  TaskOutputItem,
  TaskProgress,
  TaskQuestionItem,
  TaskTurn,
  UpdateAutomationInput,
  UpdateAutomationPatch,
  UpdatePersonaInput,
  UpdatePersonaPatch,
  UpdateTaskInput,
  UpdateTaskPatch,
  WriteResult
} from "$capabilities/agents/types/agents";
