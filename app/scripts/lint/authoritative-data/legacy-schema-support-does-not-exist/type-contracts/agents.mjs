import ts from "typescript";
import { exactTypeUnion, unwrappedType, literalFields, unionArms, exactFields, armNamed } from "./shared.mjs";

export const messageContractIn = (node, path, found) => {
  if (
    !path.replaceAll("\\", "/").endsWith("/representation/data/types/agents/message.ts") ||
    !ts.isTypeAliasDeclaration(node)
  ) return;
  if (node.name.text === "MessageState" && !exactTypeUnion(node.type, ["literal:complete"])) {
    found.add("MessageState.contract");
  }
  if (node.name.text === "Message" && !exactFields(literalFields(node.type), new Map([
    ["id", { optional: false, type: "string" }],
    ["role", { optional: false, type: "MessageRole" }],
    ["author", { optional: false, type: "Actor" }],
    ["sentAt", { optional: false, type: "number" }],
    ["blocks", { optional: false, type: "ContentBlock[]" }],
    ["attachments", { optional: true, type: "ResourceRef[]" }],
    ["labels", { optional: true, type: "string[]" }],
    ["state", { optional: false, type: "MessageState" }]
  ]))) found.add("Message.contract");
};

export const agentContractIn = (node, path, found) => {
  if (!path.replaceAll("\\", "/").endsWith(
    "/representation/data/types/agents/agent-task.ts"
  ) || !ts.isTypeAliasDeclaration(node)) return;
  if (node.name.text === "AgentTaskExecution" && !exactFields(literalFields(node.type), new Map([
    ["kind", { optional: false, type: '"grounded"' }]
  ]))) found.add("AgentTaskExecution.contract");
  if (node.name.text === "AgentTaskLifecycle") {
    const arms = unionArms(node.type);
    const running = new Map([
      ["state", { optional: false, type: '"running"' }],
      ["execution", { optional: false, type: "AgentTaskExecution" }],
      ["finishedAt", { optional: true, type: "never" }],
      ["reviewedBy", { optional: true, type: "never" }]
    ]);
    const review = new Map([
      ["state", { optional: false, type: '"review"' }],
      ["execution", { optional: true, type: "never" }],
      ["finishedAt", { optional: false, type: "number" }],
      ["reviewedBy", { optional: true, type: "never" }]
    ]);
    const finished = new Map([
      ["state", { optional: false, type: '"finished"' }],
      ["execution", { optional: true, type: "never" }],
      ["finishedAt", { optional: false, type: "number" }],
      ["reviewedBy", { optional: true, type: "Actor" }]
    ]);
    if (
      arms.length !== 3 ||
      !exactFields(literalFields(armNamed(arms, "running")), running) ||
      !exactFields(literalFields(armNamed(arms, "review")), review) ||
      !exactFields(literalFields(armNamed(arms, "finished")), finished)
    ) found.add("AgentTaskLifecycle.contract");
  }
  if (node.name.text === "TaskQuestion") {
    const held = unwrappedType(node.type);
    const variants = ts.isIntersectionTypeNode(held)
      ? held.types.map(unwrappedType).find(ts.isUnionTypeNode)
      : undefined;
    const arms = variants === undefined ? [] : unionArms(variants);
    const open = new Map([
      ["state", { optional: false, type: '"open"' }],
      ["answer", { optional: true, type: "never" }],
      ["answeredAt", { optional: true, type: "never" }],
      ["answeredBy", { optional: true, type: "never" }],
      ["rejectedAt", { optional: true, type: "never" }]
    ]);
    const answered = new Map([
      ["state", { optional: false, type: '"answered"' }],
      ["answer", { optional: false, type: "string" }],
      ["answeredAt", { optional: false, type: "number" }],
      ["answeredBy", { optional: false, type: "Actor" }],
      ["rejectedAt", { optional: true, type: "never" }]
    ]);
    const rejected = new Map([
      ["state", { optional: false, type: '"rejected"' }],
      ["answer", { optional: true, type: "never" }],
      ["answeredAt", { optional: true, type: "never" }],
      ["answeredBy", { optional: false, type: "Actor" }],
      ["rejectedAt", { optional: false, type: "number" }]
    ]);
    if (
      arms.length !== 3 ||
      !exactFields(literalFields(armNamed(arms, "open")), open) ||
      !exactFields(literalFields(armNamed(arms, "answered")), answered) ||
      !exactFields(literalFields(armNamed(arms, "rejected")), rejected)
    ) found.add("TaskQuestion.contract");
  }
};

export const automationContractIn = (node, path, found) => {
  if (!path.replaceAll("\\", "/").endsWith(
    "/representation/data/types/agents/automation.ts"
  ) || !ts.isTypeAliasDeclaration(node) || node.name.text !== "ScheduledTrigger") return;
  const arms = unionArms(node.type);
  const daily = new Map([
    ["kind", { optional: false, type: '"schedule"' }],
    ["at", { optional: false, type: "string" }],
    ["repeats", { optional: false, type: '"daily"|"weekdays"' }],
    ["weekday", { optional: true, type: "never" }],
    ["timezone", { optional: false, type: "string" }]
  ]);
  const weekly = new Map([
    ["kind", { optional: false, type: '"schedule"' }],
    ["at", { optional: false, type: "string" }],
    ["repeats", { optional: false, type: '"weekly"' }],
    ["weekday", { optional: false, type: "Weekday" }],
    ["timezone", { optional: false, type: "string" }]
  ]);
  if (
    arms.length !== 2 ||
    !arms.some((arm) => exactFields(literalFields(arm), daily)) ||
    !arms.some((arm) => exactFields(literalFields(arm), weekly))
  ) found.add("ScheduledTrigger.contract");
};

export const researchTurnContractIn = (node, path, found) => {
  if (!path.replaceAll("\\", "/").endsWith(
    "/representation/store/tables/investigation.ts"
  ) || !ts.isTypeAliasDeclaration(node)) return;
  const expected = new Map([
    ["ResearchTurnRunningFields", new Map([
      ["state", { optional: false, type: '"running"' }],
      ["messageId", { optional: true, type: "never" }],
      ["usage", { optional: true, type: "never" }],
      ["model", { optional: true, type: "never" }],
      ["error", { optional: true, type: "never" }],
      ["answeredAt", { optional: true, type: "never" }],
      ["blocks", { optional: false, type: "[]" }],
      ["queries", { optional: false, type: "[]" }],
      ["sources", { optional: false, type: "[]" }],
      ["findings", { optional: false, type: "[]" }]
    ])],
    ["ResearchTurnCompletedFields", new Map([
      ["state", { optional: false, type: '"answered"|"insufficient"' }],
      ["messageId", { optional: false, type: "string" }],
      ["blocks", { optional: false, type: "ContentBlock[]" }],
      ["queries", { optional: false, type: "string[]" }],
      ["sources", { optional: false, type: "ResearchSource[]" }],
      ["findings", { optional: false, type: "ResearchFinding[]" }],
      ["usage", { optional: false, type: "ResearchTurnUsage" }],
      ["model", { optional: false, type: "string" }],
      ["error", { optional: true, type: "never" }],
      ["answeredAt", { optional: false, type: "number" }]
    ])],
    ["ResearchTurnUnsuccessfulFields", new Map([
      ["state", { optional: false, type: '"failed"|"cancelled"' }],
      ["messageId", { optional: true, type: "never" }],
      ["usage", { optional: true, type: "never" }],
      ["model", { optional: true, type: "never" }],
      ["error", { optional: false, type: "string" }],
      ["answeredAt", { optional: true, type: "never" }],
      ["blocks", { optional: false, type: "[]" }],
      ["queries", { optional: false, type: "[]" }],
      ["sources", { optional: false, type: "[]" }],
      ["findings", { optional: false, type: "[]" }]
    ])]
  ]);
  if (expected.has(node.name.text)) {
    const fields = literalFields(node.type);
    if (!exactFields(fields, expected.get(node.name.text))) {
      found.add(`${node.name.text}.contract`);
    }
  }
  if (node.name.text === "ResearchTurnFields" && !exactTypeUnion(node.type, [
    "reference:ResearchTurnRunningFields",
    "reference:ResearchTurnCompletedFields",
    "reference:ResearchTurnUnsuccessfulFields"
  ])) found.add("ResearchTurnFields.contract");
};
