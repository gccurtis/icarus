export const RESEARCH_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a research persona cannot regain an empty-tools absence repair",
    names: "research-chat/api/ask/ask.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/ask/ask.ts",
      edit: (before) => before.replace(
        "orderedTools(persona.tools);",
        "orderedTools(persona.tools ?? []);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research command admission cannot ignore hidden or symbolic own keys",
    names: "research-chat/api/shared/validation.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/shared/validation.ts",
      edit: (before) => before.replace(
        "const keys = Reflect.ownKeys(input);",
        "const keys = Object.keys(input);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research command admission cannot accept structural strings in place of nominal ids",
    names: "research-chat/api/shared/validation.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/shared/validation.ts",
      edit: (before) => before.replace(
        "if (!isStoredRowId(value, table)) {",
        'if (typeof value !== "string") {'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research create-thread cannot admit a retired optional field",
    names: "research-chat/api/create-thread/validate-create-thread.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/create-thread/validate-create-thread.ts",
      edit: (before) => before.replace(
        'exactCommandInput(input, [], ["title"], "createThread")',
        'exactCommandInput(input, [], ["title", "retiredTitle"], "createThread")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research read-thread cannot admit a retired optional field",
    names: "research-chat/api/read-thread/validate-read-thread.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/read-thread/validate-read-thread.ts",
      edit: (before) => before.replace(
        'exactCommandInput(input, ["threadId"], [], "readThread")',
        'exactCommandInput(input, ["threadId"], ["retiredId"], "readThread")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research remove-thread cannot admit a retired optional field",
    names: "research-chat/api/remove-thread/validate-remove-thread.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/remove-thread/validate-remove-thread.ts",
      edit: (before) => before.replace(
        'exactCommandInput(input, ["threadId"], [], "removeThread")',
        'exactCommandInput(input, ["threadId"], ["retiredId"], "removeThread")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research stop-turn cannot admit a retired optional field",
    names: "research-chat/api/stop-turn/validate-stop-turn.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/stop-turn/validate-stop-turn.ts",
      edit: (before) => before.replace(
        'exactCommandInput(input, ["threadId"], [], "stopTurn")',
        'exactCommandInput(input, ["threadId"], ["retiredId"], "stopTurn")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research persona selection cannot admit a retired command field",
    names: "research-chat/api/set-thread-persona/validate-set-thread-persona.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/api/set-thread-persona/validate-set-thread-persona.ts",
      edit: (before) => before.replace(
        '["threadId", "personaId"],',
        '["threadId", "personaId", "retiredPersonaId"],'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research command admission cannot lose its executable exact-own-key contract",
    names: "research-chat/test/unit/command-input.test.ts",
    changes: [{
      path: "src/lib/capabilities/research-chat/test/unit/command-input.test.ts",
      edit: (before) => before.replace(
        'it("rejects hidden and symbolic compatibility fields"',
        'it("checks a few fields"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a completed Research turn cannot make its successful result proof optional",
    names: "representation/store/tables/investigation.ts",
    changes: [{
      path: "src/lib/representation/store/tables/investigation.ts",
      edit: (before) => before.replace(
        "  messageId: string;\n  blocks: ContentBlock[];",
        "  messageId?: string;\n  blocks: ContentBlock[];"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research-turn admission cannot restore the removed queued state",
    names: "representation/data/behavior/investigation/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/investigation/stored-rows.ts",
      edit: (before) => before.replace(
        'if (row.state === "running") return hasExactFields(row, TURN_RUNNING, optional);',
        'if (row.state === "running" || row.state === "queued") return hasExactFields(row, TURN_RUNNING, optional);'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research unsuccessful turns cannot retain successful result fields",
    names: "representation/data/behavior/investigation/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/investigation/stored-rows.ts",
      edit: (before) => before.replace(
        "return hasExactFields(row, TURN_UNSUCCESSFUL, optional);",
        'return hasExactFields(row, TURN_COMPLETED, [...optional, "error"]);'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research running turns cannot carry nonempty result arrays",
    names: "representation/data/behavior/investigation/stored-rows.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/investigation/stored-rows.ts",
      edit: (before) => before.replace(
        "return (row.blocks as unknown[]).length === 0 && row.queries.length === 0 &&",
        "return Array.isArray(row.blocks) && Array.isArray(row.queries) &&"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Research-turn admission cannot lose its executable exact-arm contract",
    names: "investigation/test/unit/stored-research-turn.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/investigation/test/unit/stored-research-turn.test.ts",
      edit: (before) => before.replace(
        'it("rejects the removed queued shape and every mixed lifecycle arm"',
        'it("checks some lifecycle values"'
      )
    }]
  }
];
