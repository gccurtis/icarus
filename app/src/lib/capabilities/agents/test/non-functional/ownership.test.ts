import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const commandSources = {
  answerTaskQuestion: "../../api/answer-task-question/answer-task-question.ts",
  createAutomation: "../../api/create-automation/create-automation.ts",
  createChat: "../../api/create-chat/create-chat.ts",
  createPersona: "../../api/create-persona/create-persona.ts",
  createTask: "../../api/create-task/create-task.ts",
  duplicatePersona: "../../api/duplicate-persona/duplicate-persona.ts",
  removeAutomation: "../../api/remove-automation/remove-automation.ts",
  removePersona: "../../api/remove-persona/remove-persona.ts",
  runAutomation: "../../api/run-automation/run-automation.ts",
  sendTaskMessage: "../../api/send-task-message/send-task-message.ts",
  updateAutomation: "../../api/update-automation/update-automation.ts",
  updatePersona: "../../api/update-persona/update-persona.ts",
  updateTask: "../../api/update-task/update-task.ts"
} as const;

describe("cross-project Agents ownership", () => {
  test("every command resolves its subject through the request scope", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toMatch(/scope\.projectId|findVisible\(store, scope/);
    }
  });

  test("no command takes a project from its own input", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).not.toMatch(/asked\.projectId/);
    }
  });
});
