export const AGENTS_TYPES_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a current thread message cannot make its author optional",
    names: "representation/data/types/agents/message.ts",
    changes: [{
      path: "src/lib/representation/data/types/agents/message.ts",
      edit: (before) => before.replace(
        "  author: Actor;",
        "  author?: Actor;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a current thread message cannot restore a partial state",
    names: "representation/data/types/agents/message.ts",
    changes: [{
      path: "src/lib/representation/data/types/agents/message.ts",
      edit: (before) => before.replace(
        'export type MessageState = "complete";',
        'export type MessageState = "complete" | "streaming";'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a complete current thread message cannot restore an error field",
    names: "representation/data/types/agents/message.ts",
    changes: [{
      path: "src/lib/representation/data/types/agents/message.ts",
      edit: (before) => before.replace(
        "  labels?: string[];\n  state: MessageState;",
        "  labels?: string[];\n  error?: string;\n  state: MessageState;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a running Agent task cannot make its executor discriminator optional",
    names: "representation/data/types/agents/agent-task.ts",
    changes: [{
      path: "src/lib/representation/data/types/agents/agent-task.ts",
      edit: (before) => before.replace(
        "      execution: AgentTaskExecution;",
        "      execution?: AgentTaskExecution;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "an open task question cannot carry settlement fields through explicit undefined",
    names: "representation/data/types/agents/agent-task.ts",
    changes: [{
      path: "src/lib/representation/data/types/agents/agent-task.ts",
      edit: (before) => before.replace(
        "      answer?: never;",
        "      answer?: string;"
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "a weekly Agent schedule cannot omit its weekday",
    names: "representation/data/types/agents/automation.ts",
    changes: [{
      path: "src/lib/representation/data/types/agents/automation.ts",
      edit: (before) => before.replace(
        "      weekday: Weekday;",
        "      weekday?: Weekday;"
      )
    }]
  }
];
