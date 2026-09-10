import { CONTENT_TYPES_MUTATIONS } from "./content-types.mjs";
import { CONTENT_ADMISSION_MUTATIONS } from "./content-admission.mjs";

export const CONTENT_MUTATIONS = [
  ...CONTENT_TYPES_MUTATIONS,
  ...CONTENT_ADMISSION_MUTATIONS
];
