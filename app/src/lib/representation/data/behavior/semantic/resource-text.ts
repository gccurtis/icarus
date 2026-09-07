import { projectResource } from "$representation/data/behavior/semantic/projection/project-resource";
import type { ProjectResourceInput } from "$representation/data/behavior/semantic/projection/contract";
import type { SemanticResourceProjection } from "$representation/data/types/semantic/source";

/** Compatibility facade for exact-text callers; material callers use projectResource. */
export const projectResourceText = (input: ProjectResourceInput): SemanticResourceProjection =>
  projectResource(input).exact;

export type { ProjectResourceInput };
