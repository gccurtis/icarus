import {
  answerTaskQuestion as answerTaskQuestionRemote,
  readAgentsLibrary,
  readTask
} from "$capabilities/agents/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { flightKey } from "$app-views/categories/agents/procedures/agents";

export const answerTaskQuestion = (
  view: WorkspaceStateModel,
  taskId: string,
  questionId: string,
  reply: { readonly answer: string } | { readonly reject: true }
) =>
  view.singleFlight(flightKey(view, "answer-task-question", taskId, questionId), () =>
    answerTaskQuestionRemote({ taskId, questionId, ...reply }).updates(
      readAgentsLibrary,
      readTask({ taskId })
    )
  );
