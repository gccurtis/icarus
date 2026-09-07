import { fieldsOf, has, idOf, only, textOf } from "$capabilities/agents/api/shared/validation";
import type { AnswerTaskQuestionInput } from "$capabilities/agents/types/agents";

const SUBJECT = "answer-task-question";

export const validateAnswerTaskQuestion = (input: unknown): AnswerTaskQuestionInput => {
  const fields = fieldsOf(input, SUBJECT);
  only(fields, ["taskId", "questionId", "answer", "reject"], SUBJECT);
  const rejecting = fields.reject === true;
  if (!rejecting && !has(fields, "answer")) {
    throw new Error(`agents/${SUBJECT}: an answer or a rejection is required`);
  }
  if (rejecting && has(fields, "answer")) {
    throw new Error(`agents/${SUBJECT}: a rejection carries no answer`);
  }
  return {
    taskId: idOf(fields.taskId, SUBJECT, "taskId"),
    questionId: idOf(fields.questionId, SUBJECT, "questionId"),
    ...(rejecting ? { reject: true } : { answer: textOf(fields.answer, SUBJECT, "answer", 20_000) })
  };
};
