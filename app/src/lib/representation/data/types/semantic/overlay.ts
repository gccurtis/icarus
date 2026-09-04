import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";

/** The one vector space shared by every active object in a project overlay. */
export type EmbeddingSpace = {
  provider: "jina";
  model: string;
  dimensions: number;
};

/** A half-open source interval interpreted in its source's declared encoding. */
export type SemanticSpan = {
  from: number;
  to: number;
  text: string;
};

/** The value retained when an active semantic object is retired. */
export type SemanticObjectSnapshot = {
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  vector: number[];
};
