export const RESEARCH_GATES = [
  {
    path: ["capabilities", "research-chat", "api", "shared", "validation.ts"],
    name: "research-command-own-keys",
    required: /const keys = Reflect\.ownKeys\(input\);[\s\S]*?typeof key !== "string" \|\| !allowed\.includes\(key\)[\s\S]*?required\.find\(\(field\) => !Object\.hasOwn\(input, field\)\)/,
    message: "Research command admission does not reject every unknown own key or require own current fields"
  },
  {
    path: ["capabilities", "research-chat", "api", "shared", "validation.ts"],
    name: "research-command-nominal-id",
    required: /if \(!isStoredRowId\(value, table\)\) \{[\s\S]*?return value;/,
    message: "Research command admission accepts a non-nominal represented row id"
  },
  {
    path: ["capabilities", "research-chat", "api", "create-thread", "validate-create-thread.ts"],
    name: "research-create-command-shape",
    required: /exactCommandInput\(input, \[\], \["title"\], "createThread"\)/,
    message: "Research create-thread admission no longer has its exact current command shape"
  },
  {
    path: ["capabilities", "research-chat", "api", "read-thread", "validate-read-thread.ts"],
    name: "research-read-command-shape",
    required: /exactCommandInput\(input, \["threadId"\], \[\], "readThread"\)[\s\S]*?currentRowId\(asked\.threadId, "researchThreads", "readThread"\)/,
    message: "Research read-thread admission no longer has its exact current command shape and nominal id"
  },
  {
    path: ["capabilities", "research-chat", "api", "remove-thread", "validate-remove-thread.ts"],
    name: "research-remove-command-shape",
    required: /exactCommandInput\(input, \["threadId"\], \[\], "removeThread"\)[\s\S]*?currentRowId\(asked\.threadId, "researchThreads", "removeThread"\)/,
    message: "Research remove-thread admission no longer has its exact current command shape and nominal id"
  },
  {
    path: ["capabilities", "research-chat", "api", "stop-turn", "validate-stop-turn.ts"],
    name: "research-stop-command-shape",
    required: /exactCommandInput\(input, \["threadId"\], \[\], "stopTurn"\)[\s\S]*?currentRowId\(asked\.threadId, "researchThreads", "stopTurn"\)/,
    message: "Research stop-turn admission no longer has its exact current command shape and nominal id"
  },
  {
    path: ["capabilities", "research-chat", "api", "set-thread-persona", "validate-set-thread-persona.ts"],
    name: "research-persona-command-shape",
    required: /\["threadId", "personaId"\],[\s\S]*?"setThreadPersona"[\s\S]*?currentRowId\(asked\.personaId, "personas", "setThreadPersona"\)[\s\S]*?currentRowId\(asked\.threadId, "researchThreads", "setThreadPersona"\)/,
    message: "Research persona admission no longer has its exact current command shape and nominal ids"
  },
  {
    path: ["capabilities", "research-chat", "test", "unit", "command-input.test.ts"],
    name: "research-command-admission-contract",
    required: /validateCreateThread[\s\S]*?validateReadThread[\s\S]*?validateRemoveThread[\s\S]*?validateSetThreadPersona[\s\S]*?validateStopTurn[\s\S]*?requires an exact nominal id[\s\S]*?rejects hidden and symbolic compatibility fields/,
    message: "Research command admission lacks its executable exact-shape and nominal-id contract"
  },
  {
    path: ["representation", "data", "behavior", "investigation", "stored-rows.ts"],
    name: "research-turn-exact-lifecycle-admission",
    required: /if \(row\.state === "running"\) return hasExactFields\(row, TURN_RUNNING, optional\);[\s\S]*?row\.state === "answered" \|\| row\.state === "insufficient"[\s\S]*?hasExactFields\(row, TURN_COMPLETED, optional\)[\s\S]*?row\.state === "failed" \|\| row\.state === "cancelled"[\s\S]*?hasExactFields\(row, TURN_UNSUCCESSFUL, optional\)/,
    forbidden: /["']queued["']/,
    message: "Research-turn storage no longer enforces exact current lifecycle-arm keys"
  },
  {
    path: ["representation", "data", "behavior", "investigation", "stored-rows.ts"],
    name: "research-turn-lifecycle-proof",
    required: /if \(row\.state === "running"\)[\s\S]*?row\.blocks as unknown\[\]\)\.length === 0[\s\S]*?row\.queries\.length === 0[\s\S]*?if \(row\.state === "failed" \|\| row\.state === "cancelled"\)[\s\S]*?isStoredText\(row\.error[\s\S]*?row\.findings\.length === 0[\s\S]*?!isStoredIdentifier\(row\.messageId\)[\s\S]*?!usage\(row\.usage\)[\s\S]*?!isStoredText\(row\.model[\s\S]*?!isStoredTime\(row\.answeredAt\)/,
    message: "Research-turn state admission no longer requires the result, failure, and time proof of its exact arm"
  },
  {
    path: ["representation", "data", "behavior", "investigation", "test", "unit", "stored-research-turn.test.ts"],
    name: "research-turn-lifecycle-contract",
    required: /admits each complete current lifecycle arm[\s\S]*?rejects the removed queued shape and every mixed lifecycle arm[\s\S]*?rejects omitted terminal proof[\s\S]*?rejects extra, symbolic, and explicitly undefined fields/,
    message: "Research-turn admission lacks its executable exact-lifecycle contract"
  }
];
