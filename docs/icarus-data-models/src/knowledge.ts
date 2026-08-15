import type {
  ActiveLifecycle,
  ContentSourceRef,
  Digest,
  EntityId,
  FailureDetail,
  ISODateTime,
  JsonObject,
  Metadata,
  PersistedRecord,
  ProjectId,
  ResourceRef,
} from './core.js';
import type { RichBlockRef } from './rich-blocks.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface CurrentProjectContextExpression {
  kind: 'current_project';
}

export interface LiveContextExpression {
  kind: 'live';
  resource: ResourceRef;
}

export interface CopyContextExpression {
  kind: 'copy';
  source: ResourceRef;
  copy: ResourceRef;
}

export interface NestedContextExpression {
  kind: 'context';
  contextId: EntityId<'context'>;
}

export interface UnionContextExpression {
  kind: 'union';
  operands: ContextExpression[];
}

export interface DifferenceContextExpression {
  kind: 'difference';
  left: ContextExpression;
  right: ContextExpression;
}

export type ContextExpression =
  | CurrentProjectContextExpression
  | LiveContextExpression
  | CopyContextExpression
  | NestedContextExpression
  | UnionContextExpression
  | DifferenceContextExpression;

export interface Context extends PersistedRecord<'context'> {
  name: string;
  normalizedName: string;
  contextType: 'authored' | 'current_project';
  expression: ContextExpression;
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
}

export interface ResolvedContextItem {
  resource: ResourceRef;
  contributedBy: EntityId<'context'>[];
}

/** Read product only: never canonical persisted state. */
export interface ResolvedContextManifest {
  contextId: EntityId<'context'>;
  contextRevision: number;
  observedAt: ISODateTime;
  items: ResolvedContextItem[];
  digest: Digest;
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export interface KnowledgeConfigurationReceipt {
  chunker: string;
  chunkerVersion: string;
  parameters: JsonObject;
  digest: Digest;
}

export interface EmbeddingSpaceReceipt {
  provider: string;
  model: string;
  dimensions: number;
  distanceMetric: 'cosine' | 'dot_product' | 'euclidean';
  digest: Digest;
}

export interface KnowledgeLatticeState {
  projectId: ProjectId;
  revision: number;
  schemaVersion: number;
  mode: 'exact' | 'scaled';
  configurationReceipt: KnowledgeConfigurationReceipt;
  embeddingSpaceReceipt: EmbeddingSpaceReceipt;
  sourceCount: number;
  artifactCount: number;
  nodeCount: number;
  updatedAt: ISODateTime;
}

export interface ResourceKnowledgeSourceDescriptor {
  kind: 'resource';
  resource: ResourceRef;
}

export interface FindingKnowledgeSourceDescriptor {
  kind: 'finding';
  findingId: EntityId<'finding'>;
  revision: number;
}

export interface WebKnowledgeSourceDescriptor {
  kind: 'web';
  url: string;
  title?: string;
  capturedAt: ISODateTime;
}

export type KnowledgeSourceDescriptor =
  | ResourceKnowledgeSourceDescriptor
  | FindingKnowledgeSourceDescriptor
  | WebKnowledgeSourceDescriptor;

export interface KnowledgeSource {
  id: EntityId<'knowledge_source'>;
  projectId: ProjectId;
  descriptor: KnowledgeSourceDescriptor;
  sourceRevision?: number;
  status: 'active' | 'removed' | 'failed';
  contentDigest: Digest;
  configurationReceiptDigest: Digest;
  embeddingSpaceReceiptDigest: Digest;
  artifactSetId: EntityId<'knowledge_artifact_set'>;
  artifactCount: number;
  admittedAt: ISODateTime;
  indexedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface KnowledgeArtifactBase<Kind extends string> {
  id: EntityId<'knowledge_artifact'>;
  projectId: ProjectId;
  sourceId: EntityId<'knowledge_source'>;
  artifactSetId: EntityId<'knowledge_artifact_set'>;
  kind: Kind;
  ordinal: number;
  contentDigest: Digest;
  embedding?: number[];
  metadata: Metadata;
  createdAt: ISODateTime;
}

export interface KnowledgeWindowArtifact
  extends KnowledgeArtifactBase<'window'> {
  text: string;
  locator: JsonObject;
}

export interface KnowledgeResourceNodeArtifact
  extends KnowledgeArtifactBase<'resource_node'> {
  text?: string;
  nodeKind: string;
  locator: JsonObject;
}

export interface KnowledgeMediaArtifact
  extends KnowledgeArtifactBase<'media_descriptor'> {
  description: string;
  mediaKind: 'image' | 'video' | 'audio';
  locator: JsonObject;
}

export interface KnowledgeOcrArtifact
  extends KnowledgeArtifactBase<'ocr_region'> {
  text: string;
  locator: JsonObject & {
    page?: number;
    region?: JsonObject;
  };
}

export interface KnowledgeFrontierArtifact
  extends KnowledgeArtifactBase<'resource_frontier'> {
  summary: string;
  childArtifactIds: EntityId<'knowledge_artifact'>[];
}

export type KnowledgeArtifact =
  | KnowledgeWindowArtifact
  | KnowledgeResourceNodeArtifact
  | KnowledgeMediaArtifact
  | KnowledgeOcrArtifact
  | KnowledgeFrontierArtifact;

export interface KnowledgeNode {
  id: EntityId<'knowledge_node'>;
  projectId: ProjectId;
  level: number;
  centroid: number[];
  memberCount: number;
  metadata: Metadata;
  createdAt: ISODateTime;
}

export type KnowledgeMembership =
  | {
      parentNodeId: EntityId<'knowledge_node'>;
      memberKind: 'artifact';
      artifactId: EntityId<'knowledge_artifact'>;
      position: number;
      distance: number;
    }
  | {
      parentNodeId: EntityId<'knowledge_node'>;
      memberKind: 'node';
      childNodeId: EntityId<'knowledge_node'>;
      position: number;
      distance: number;
    };

export interface KnowledgeRetrievalMatch {
  artifactId: EntityId<'knowledge_artifact'>;
  sourceId: EntityId<'knowledge_source'>;
  score: number;
  locator?: JsonObject;
  excerpt?: string;
}

export interface KnowledgeRetrievalReceipt {
  latticeRevision: number;
  configurationReceiptDigest: Digest;
  embeddingSpaceReceiptDigest: Digest;
  queryDigest: Digest;
  matches: KnowledgeRetrievalMatch[];
  retrievedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Derived outputs
// ---------------------------------------------------------------------------

export type DerivedOutputCast =
  | { kind: 'plain_text' }
  | { kind: 'markdown' }
  | { kind: 'rich_blocks'; allowedBlockKinds?: Array<'text' | 'image' | 'table' | 'link'> };

export interface GroundingManifest {
  context: ResolvedContextManifest;
  knowledgeLatticeRevision: number;
  sourceIds: EntityId<'knowledge_source'>[];
  artifactIds: EntityId<'knowledge_artifact'>[];
  intelligenceRoute: {
    provider: string;
    model: string;
    route: string;
  };
  promptVersion: string;
  definitionDigest: Digest;
  inputDigests: Digest[];
}

export interface GenerationReceipt {
  requestId: string;
  provider: string;
  model: string;
  startedAt: ISODateTime;
  completedAt: ISODateTime;
  tokenUsage?: {
    input: number;
    output: number;
  };
  outputDigest: Digest;
}

export type GenerationState =
  | { state: 'idle' }
  | { state: 'generating'; startedAt: ISODateTime }
  | { state: 'ready'; acceptedAt: ISODateTime }
  | { state: 'stale'; reason: string; detectedAt: ISODateTime }
  | { state: 'failed'; failure: FailureDetail; failedAt: ISODateTime };

export interface DerivedOutput extends PersistedRecord<'derived_output'> {
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
  name: string;
  instruction: RichBlockRef<'text'>;
  contextId: EntityId<'context'>;
  cast: DerivedOutputCast;
  definitionDigest: Digest;
  contentBlocks: RichBlockRef[];
  contentDigest?: Digest;
  groundingManifest?: GroundingManifest;
  generationReceipt?: GenerationReceipt;
  generationState: GenerationState;
  dependencies: ContentSourceRef[];
}
