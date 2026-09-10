import { AGENT_ROW_POLICIES } from "$representation/store/schema/agents";
import { EDITOR_ROW_POLICIES } from "$representation/store/schema/editors";
import { FOUNDATION_ROW_POLICIES } from "$representation/store/schema/foundations";
import { SEMANTIC_ROW_POLICIES } from "$representation/store/schema/semantic";
import { TEMPLATE_ROW_POLICIES } from "$representation/store/schema/templates";
import type { CurrentRowPolicies } from "$representation/store/schema/types";

/** One exhaustive field-presence policy shared by load, create, update, and recovery. */
export const CURRENT_ROW_POLICIES = {
  ...FOUNDATION_ROW_POLICIES,
  ...EDITOR_ROW_POLICIES,
  ...AGENT_ROW_POLICIES,
  ...TEMPLATE_ROW_POLICIES,
  ...SEMANTIC_ROW_POLICIES
} satisfies CurrentRowPolicies;
