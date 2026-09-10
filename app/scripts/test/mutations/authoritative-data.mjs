import { GUARDRAILS_MUTATIONS } from "./authoritative-data/guardrails.mjs";
import { EDITORS_MUTATIONS } from "./authoritative-data/editors.mjs";
import { SEMANTIC_MUTATIONS } from "./authoritative-data/semantic.mjs";
import { TEMPLATES_MUTATIONS } from "./authoritative-data/templates.mjs";
import { CORE_MUTATIONS } from "./authoritative-data/core.mjs";
import { AGENTS_MUTATIONS } from "./authoritative-data/agents.mjs";
import { RESEARCH_MUTATIONS } from "./authoritative-data/research.mjs";
import { PROJECT_MUTATIONS } from "./authoritative-data/project.mjs";
import { SPREADSHEET_MUTATIONS } from "./authoritative-data/spreadsheet.mjs";
import { WORKSPACE_MUTATIONS } from "./authoritative-data/workspace.mjs";
import { CONTENT_MUTATIONS } from "./authoritative-data/content.mjs";
import { EXTERNAL_MUTATIONS } from "./authoritative-data/external.mjs";
import { STORE_MUTATIONS } from "./authoritative-data/store.mjs";
import { VARIABLES_MUTATIONS } from "./authoritative-data/variables.mjs";

export const MUTATIONS = [
  ...GUARDRAILS_MUTATIONS,
  ...EDITORS_MUTATIONS,
  ...SEMANTIC_MUTATIONS,
  ...TEMPLATES_MUTATIONS,
  ...CORE_MUTATIONS,
  ...AGENTS_MUTATIONS,
  ...RESEARCH_MUTATIONS,
  ...PROJECT_MUTATIONS,
  ...SPREADSHEET_MUTATIONS,
  ...WORKSPACE_MUTATIONS,
  ...CONTENT_MUTATIONS,
  ...EXTERNAL_MUTATIONS,
  ...STORE_MUTATIONS,
  ...VARIABLES_MUTATIONS
];
