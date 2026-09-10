export const AGENTS_GATES = [
  {
    path: ["representation", "data", "behavior", "agents", "stored-thread.ts"],
    name: "thread-message-exact-complete",
    required: /\["id",\s*"role",\s*"author",\s*"sentAt",\s*"blocks",\s*"state"\],[\s\S]*?\["attachments",\s*"labels"\][\s\S]*?isStoredActor\(held\.author\)[\s\S]*?held\.state === "complete"/,
    message: "thread-message admission no longer requires an authored, error-free, complete current shape"
  },
  {
    path: ["representation", "data", "behavior", "agents", "test", "unit", "stored-thread.test.ts"],
    name: "thread-message-exactness-contract",
    required: /admits the complete current thread and message partition[\s\S]*?rejects partial messages, unknown nested fields, and duplicate message ids[\s\S]*?state: "streaming"[\s\S]*?state: "error", error:/,
    message: "thread-message admission lacks its executable complete-only, authored, error-free contract"
  },
  {
    path: ["representation", "data", "behavior", "agents", "stored", "task.ts"],
    name: "agent-task-lifecycle-admission",
    required: /held\.state === "running"[\s\S]*?\[\.\.\.TASK_FIELDS, "execution"\][\s\S]*?taskExecution\(held\.execution\)[\s\S]*?held\.state === "review"[\s\S]*?\[\.\.\.TASK_FIELDS, "finishedAt"\][\s\S]*?held\.state === "finished"[\s\S]*?\["scope", "reviewedBy"\]/,
    forbidden: /["']queued["']/,
    message: "Agent-task storage no longer requires one exact state-specific lifecycle arm"
  },
  {
    path: ["representation", "data", "behavior", "agents", "stored", "task.ts"],
    name: "agent-question-lifecycle-admission",
    required: /if \(held\.state === "open"\)[\s\S]*?\["id", "text", "askedAt", "state"\][\s\S]*?held\.state === "answered"[\s\S]*?"answer", "answeredAt", "answeredBy"[\s\S]*?held\.state === "rejected"[\s\S]*?"rejectedAt", "answeredBy"/,
    message: "Agent-task question storage no longer enforces exact open, answered, and rejected arms"
  },
  {
    path: ["representation", "data", "behavior", "agents", "stored", "automation.ts"],
    name: "agent-ordered-values-and-schedules",
    required: /const selectorKinds[\s\S]*?new Set\(value\)\.size === value\.length[\s\S]*?order\.get\(kind\)! > order\.get\(value\[index - 1\]\)![\s\S]*?held\.repeats === "weekly"[\s\S]*?"weekday"[\s\S]*?isWeekday\(held\.weekday\)[\s\S]*?exact\(held, \["kind", "at", "repeats", "timezone"\]\)/,
    message: "Agent stored values can regain duplicate, reordered, or ambiguous schedule variants"
  },
  {
    path: ["representation", "data", "behavior", "agents", "stored", "shared.ts"],
    name: "agent-ordered-tools",
    required: /const storedTools[\s\S]*?ordered\.length === value\.length[\s\S]*?entry === value\[index\]/,
    message: "Agent stored tools can regain duplicate or reordered values"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "validation-fields.ts"],
    name: "agent-command-own-keys",
    required: /storedFields\(value\)[\s\S]*?hasExactFields\(fields, \[\], allowed\)[\s\S]*?Reflect\.ownKeys\(fields\)[\s\S]*?typeof field !== "string" \|\| !allowed\.includes\(field\)/,
    message: "Agent command admission no longer requires exact plain own-key sets"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "validation.ts"],
    name: "agent-command-ids-and-order",
    required: /if \(!isStoredRowId\(value, table\)\)[\s\S]*?const ordered = orderedTools[\s\S]*?ordered\.length !== list\.length[\s\S]*?entry !== list\[index\]/,
    message: "Agent command admission no longer requires exact own keys, nominal ids, and canonical tools"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "validation.ts"],
    name: "agent-command-exact-variants",
    required: /const label = textOf\(fields\.label[\s\S]*?if \(repeats === "weekly"\)[\s\S]*?only\(fields, \["kind", "at", "repeats", "weekday", "timezone"\][\s\S]*?only\(fields, \["kind", "at", "repeats", "timezone"\][\s\S]*?if \(fields\.kind === "resource-edited"\)[\s\S]*?has\(fields, "ref"\)[\s\S]*?resourceRefOf\(fields\.ref/,
    message: "Agent command admission can infer a cast, schedule arm, or present resource reference"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "resume-agent-tasks.ts"],
    name: "agent-resume-explicit-two-phase",
    required: /const resumable = tasks\.filter\(\(task\) => task\.state === "running"\);[\s\S]*?const verified = resumable\.map[\s\S]*?task\.execution\.kind !== "grounded"[\s\S]*?readAgentExecutionState[\s\S]*?for \(const taskId of verified\)[\s\S]*?dispatchAgentTask\(model, taskId\)/,
    forbidden: /isRunnerPlan|resumable\.map[\s\S]*?dispatchAgentTask\(model, task\._id\)[\s\S]*?return execution\.task\._id/,
    message: "Agent startup filters by inferred plan text or dispatches before every resumable aggregate is validated"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "runner-plan.ts"],
    name: "agent-plan-does-not-discriminate-execution",
    required: /export const queuedRunnerPlan/,
    forbidden: /isRunnerPlan/,
    message: "Agent execution ownership is inferred from magic plan text"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "names.ts"],
    name: "agent-names-are-project-scoped",
    required: /isStoredPersona\(row\) && row\.projectId === projectId[\s\S]*?isStoredAutomation\(row\) && row\.projectId === projectId[\s\S]*?isStoredAgentTask\(row\) && row\.projectId === projectId/,
    message: "Agent name projection can resolve a persona, automation, or task actor from another project"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "execute-agent-task.ts"],
    name: "agent-success-replaces-lifecycle-arm",
    required: /const fields: RowFields<"agentTasks"> = \{[\s\S]*?state: "review"[\s\S]*?finishedAt: at[\s\S]*?unit\.update\(`agentTasks\.\$\{current\._id\}`, fields\)/,
    forbidden: /unit\.update\(`agentTasks\.\$\{current\._id\}\.state`/,
    message: "Agent completion mutates lifecycle fragments instead of replacing the exact review arm"
  },
  {
    path: ["capabilities", "agents", "api", "shared", "settle-agent-task-failure.ts"],
    name: "agent-failure-replaces-lifecycle-arm",
    required: /const fields: RowFields<"agentTasks"> = \{[\s\S]*?state: "finished"[\s\S]*?finishedAt: at[\s\S]*?unit\.update\(`agentTasks\.\$\{task\._id\}`, fields\)/,
    forbidden: /unit\.update\(`agentTasks\.\$\{task\._id\}\.state`/,
    message: "Agent failure mutates lifecycle fragments instead of replacing the exact terminal arm"
  },
  {
    path: ["capabilities", "agents", "api", "answer-task-question", "answer-task-question.ts"],
    name: "agent-question-writer-selects-arm",
    required: /state: "rejected" as const[\s\S]*?rejectedAt: at[\s\S]*?state: "answered" as const[\s\S]*?answeredAt: at/,
    message: "Agent question settlement writes fields without selecting one exact lifecycle arm"
  },
  {
    path: ["representation", "data", "behavior", "agents", "test", "unit", "stored-rows.test.ts"],
    name: "agent-stored-exactness-contract",
    required: /requires one complete state-specific lifecycle arm[\s\S]*?does not infer the executor from a familiar plan[\s\S]*?requires exact question lifecycle arms[\s\S]*?requires exact schedule arms/,
    message: "Agent stored admission lacks its executable current-lifecycle and variant contract"
  },
  {
    path: ["capabilities", "agents", "test", "unit", "command-input.test.ts"],
    name: "agent-command-exactness-contract",
    required: /requires the nominal table namespace[\s\S]*?rejects hidden, symbolic, and unknown own command fields[\s\S]*?requires tools exactly once and in catalogue order[\s\S]*?requires exact weekly and non-weekly schedule arms[\s\S]*?requires unique catalogue-ordered trigger kinds and omitted absent references/,
    message: "Agent commands lack their executable exact-own-key, nominal-id, order, and variant contract"
  },
  {
    path: ["capabilities", "agents", "test", "non-functional", "grounded-runner.test.ts"],
    name: "agent-runner-discriminator-contract",
    required: /resumes an explicitly grounded task without inferring ownership from plan text[\s\S]*?validates every resumable aggregate before activating any task/,
    message: "Agent startup lacks its executable explicit-discriminator and two-phase validation contract"
  }
];
