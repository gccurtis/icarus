export const AGENTS_COMMANDS_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a stored persona cannot regain an empty-tools absence repair",
    names: "agents/api/shared/projection.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/projection.ts",
      edit: (before) => before.replace(
        "tools: orderedTools(persona.tools),",
        "tools: orderedTools(persona.tools ?? []),"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a stored task cannot regain an empty-tools absence repair",
    names: "agents/api/shared/task-projection.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/task-projection.ts",
      edit: (before) => before.replace(
        "tools: orderedTools(task.tools),",
        "tools: orderedTools(task.tools ?? []),"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent command admission cannot ignore hidden or symbolic own fields",
    names: "agents/api/shared/validation-fields.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/validation-fields.ts",
      edit: (before) => before.replace(
        "const extra = Reflect.ownKeys(fields).filter(",
        "const extra = Object.keys(fields).filter("
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent command ids cannot accept structural strings from the wrong table",
    names: "agents/api/shared/validation.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/validation.ts",
      edit: (before) => before.replace(
        "if (!isStoredRowId(value, table)) {",
        'if (typeof value !== "string") {'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent command tools cannot be silently reordered or deduplicated",
    names: "agents/api/shared/validation.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/validation.ts",
      edit: (before) => before.replace(
        "  if (\n    ordered.length !== list.length ||\n    ordered.some((entry, index) => entry !== list[index])\n  ) fail(subject, \"tools contains unique ids in catalogue order\");",
        "  if (ordered.length === 0 && list.length > 0) fail(subject, \"tools are known\");"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent cast admission cannot invent a missing label",
    names: "agents/api/shared/validation.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/validation.ts",
      edit: (before) => before.replace(
        "const label = textOf(fields.label, subject, \"cast label\", 80);",
        'const label = typeof fields.label === "string" ? fields.label : "Default";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent command schedules cannot make the weekly weekday optional",
    names: "agents/api/shared/validation.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/validation.ts",
      edit: (before) => before.replace(
        'only(fields, ["kind", "at", "repeats", "weekday", "timezone"], subject);',
        'only(fields, ["kind", "at", "repeats", "timezone"], subject);'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent command admission cannot treat an explicit undefined ref as omission",
    names: "agents/api/shared/validation.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/validation.ts",
      edit: (before) => before.replace(
        'return has(fields, "ref")',
        'return fields.ref !== undefined'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent startup cannot select tasks by magic plan text",
    names: "agents/api/shared/resume-agent-tasks.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/resume-agent-tasks.ts",
      edit: (before) => before.replace(
        'const resumable = tasks.filter((task) => task.state === "running");',
        'const resumable = tasks.filter((task) => task.state === "running" && isRunnerPlan(task.plan));'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent startup cannot dispatch an early row before every aggregate validates",
    names: "agents/api/shared/resume-agent-tasks.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/resume-agent-tasks.ts",
      edit: (before) => before.replace(
        "  const verified = resumable.map((task) => {",
        "  const verified = resumable.map((task) => {\n    dispatchAgentTask(model, task._id);"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "the Agent plan module cannot become an execution discriminator",
    names: "agents/api/shared/runner-plan.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/runner-plan.ts",
      edit: (before) => `${before}\nexport const isRunnerPlan = () => true;\n`
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent name projection cannot resolve cross-project rows",
    names: "agents/api/shared/names.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/names.ts",
      edit: (before) => before.replace(
        '.filter((row) => isStoredPersona(row) && row.projectId === projectId)',
        ".filter(isStoredPersona)"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent completion cannot leave its running execution arm attached",
    names: "agents/api/shared/execute-agent-task.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/execute-agent-task.ts",
      edit: (before) => before.replace(
        "    unit.update(`agentTasks.${current._id}`, fields);",
        '    unit.update(`agentTasks.${current._id}.state`, "review");'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent failure cannot leave its running execution arm attached",
    names: "agents/api/shared/settle-agent-task-failure.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/shared/settle-agent-task-failure.ts",
      edit: (before) => before.replace(
        "    unit.update(`agentTasks.${task._id}`, fields);",
        '    unit.update(`agentTasks.${task._id}.state`, "finished");'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent question settlement cannot omit the selected state arm",
    names: "agents/api/answer-task-question/answer-task-question.ts",
    changes: [{
      path: "src/lib/capabilities/agents/api/answer-task-question/answer-task-question.ts",
      edit: (before) => before.replace(
        'state: "rejected" as const,',
        ""
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent command admission cannot lose its executable exactness contract",
    names: "agents/test/unit/command-input.test.ts",
    changes: [{
      path: "src/lib/capabilities/agents/test/unit/command-input.test.ts",
      edit: (before) => before.replace(
        'it("rejects hidden, symbolic, and unknown own command fields"',
        'it("checks own command fields"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent startup cannot lose its executable two-phase discriminator contract",
    names: "agents/test/non-functional/grounded-runner.test.ts",
    changes: [{
      path: "src/lib/capabilities/agents/test/non-functional/grounded-runner.test.ts",
      edit: (before) => before.replace(
        'test("validates every resumable aggregate before activating any task"',
        'test("checks resumable aggregates"'
      )
    }]
  }
];
