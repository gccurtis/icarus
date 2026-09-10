import { AGENTS_COMMANDS_MUTATIONS } from "./agents-commands.mjs";
import { AGENTS_TYPES_MUTATIONS } from "./agents-types.mjs";
import { AGENTS_ADMISSION_MUTATIONS } from "./agents-admission.mjs";

export const AGENTS_MUTATIONS = [
  ...AGENTS_COMMANDS_MUTATIONS,
  ...AGENTS_TYPES_MUTATIONS,
  ...AGENTS_ADMISSION_MUTATIONS
];
