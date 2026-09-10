export const AGENTS_ADMISSION_MUTATIONS = [
  {
    check: "legacy-schema-support-does-not-exist",
    says: "thread admission cannot accept an authorless old message shape",
    names: "representation/data/behavior/agents/stored-thread.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/stored-thread.ts",
      edit: (before) => before.replace(
        '["id", "role", "author", "sentAt", "blocks", "state"],\n      ["attachments", "labels"]',
        '["id", "role", "sentAt", "blocks", "state"],\n      ["author", "attachments", "labels", "error"]'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "thread admission cannot restore a retired message error field",
    names: "representation/data/behavior/agents/stored-thread.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/stored-thread.ts",
      edit: (before) => before.replace(
        '["attachments", "labels"]',
        '["attachments", "labels", "error"]'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "thread admission cannot restore a partial message state",
    names: "representation/data/behavior/agents/stored-thread.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/stored-thread.ts",
      edit: (before) => before.replace(
        'held.state === "complete";',
        '["complete", "streaming"].includes(String(held.state));'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "thread-message admission cannot lose its executable complete-only contract",
    names: "representation/data/behavior/agents/test/unit/stored-thread.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/test/unit/stored-thread.test.ts",
      edit: (before) => before.replace(
        'it("rejects partial messages, unknown nested fields, and duplicate message ids"',
        'it("checks messages"'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "stored Agent tasks cannot infer a missing executor from other fields",
    names: "representation/data/behavior/agents/stored/task.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/stored/task.ts",
      edit: (before) => before.replace(
        '[...TASK_FIELDS, "execution"], ["scope"]',
        'TASK_FIELDS, ["scope", "execution"]'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "stored Agent questions cannot mix open and answered fields",
    names: "representation/data/behavior/agents/stored/task.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/stored/task.ts",
      edit: (before) => before.replace(
        'if (held.state === "open") {',
        'if (held.state === "open" || held.state === undefined) {'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "stored Agent schedules cannot default a missing weekly weekday",
    names: "representation/data/behavior/agents/stored/automation.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/stored/automation.ts",
      edit: (before) => before.replace(
        "isWeekday(held.weekday)",
        'isWeekday(held.weekday ?? "Monday")'
      )
    }]
  },
  {
    check: "legacy-schema-support-does-not-exist",
    says: "Agent stored admission cannot lose its executable lifecycle contract",
    names: "agents/test/unit/stored-rows.test.ts",
    changes: [{
      path: "src/lib/representation/data/behavior/agents/test/unit/stored-rows.test.ts",
      edit: (before) => before.replace(
        'it("does not infer the executor from a familiar plan"',
        'it("checks a familiar plan"'
      )
    }]
  }
];
