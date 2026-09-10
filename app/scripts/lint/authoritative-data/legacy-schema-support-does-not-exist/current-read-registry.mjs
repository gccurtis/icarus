export const REQUIRED_DISCRIMINATOR_READS = new Set(["lane"]);

/** Required current fields whose absence must never be repaired by a reader. */
const REQUIRED_CURRENT_READS = new Map([
  ["/capabilities/derived-output/api/shared/refresh-queue.ts", new Set([
    "*.requestedVersion"
  ])],
  ["/capabilities/document/api/submit-document-changes/submit-document-changes.ts", new Set([
    "leader.body",
    "leader.revision"
  ])],
  ["/capabilities/templates/api/shared/scopes.ts", new Set([
    "row.revision"
  ])],
  ["/capabilities/templates/api/shared/prompts.ts", new Set([
    "value.prompt"
  ])],
  ["/capabilities/templates/api/shared/body-validation/blocks.ts", new Set([
    "value.prompt"
  ])],
  ["/capabilities/agents/api/shared/projection.ts", new Set([
    "automation.tools",
    "persona.definition.approach",
    "persona.definition.background",
    "persona.definition.focus",
    "persona.definition.outputPreferences",
    "persona.definition.verification",
    "persona.tools"
  ])],
  ["/capabilities/agents/api/shared/task-projection.ts", new Set([
    "task.tools"
  ])],
  ["/capabilities/research-chat/api/ask/ask.ts", new Set([
    "persona.tools"
  ])],
  ["/capabilities/project/api/shared/projection.ts", new Set([
    "row.actorLabel"
  ])],
  ["/capabilities/project/api/read-project-comment/read-project-comment.ts", new Set([
    "row.author",
    "row.blocks"
  ])],
  ["/capabilities/project/api/read-project-resource/read-project-resource.ts", new Set([
    "*.body",
    "*.revision",
    "*.role",
    "body.columns",
    "body.rows",
    "body.slides"
  ])],
  ["/capabilities/spreadsheet/api/shared/answering.ts", new Set([
    "*.usedBy",
    "row.body"
  ])],
  ["/model/client/workspace-state/methods/shared/adopt.ts", new Set([
    "row.activeId",
    "row.revision",
    "row.tabs",
    "row.views"
  ])],
  ["/representation/data/behavior/workspace/stored-rows.ts", new Set([
    "row.activeId",
    "row.tabs",
    "row.views"
  ])]
]);

export const DEFAULT_HELPER =
  /^(?:coalesce|default(?:To)?|fallback|fromNullable|orElse|valueOr|withDefault)$/i;
export const READ_PRESERVING_HELPER =
  /^(?:boundedText|finiteTime|flag|idOf|Number|recordOf|width)$/;

export const readsFor = (path) => {
  const normalized = path.replaceAll("\\", "/");
  for (const [suffix, reads] of REQUIRED_CURRENT_READS) {
    if (normalized.endsWith(suffix)) return reads;
  }
  return undefined;
};
