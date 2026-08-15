import type {
  ActorId,
  ActorRef,
  Digest,
  EntityId,
  ISODateTime,
  JsonObject,
  Metadata,
  PersistedRecord,
  ProjectId,
  Rank,
  ResourceKind,
  Revisioned,
  Timestamped,
  UserId,
} from './core.js';
import type { RichBlockRef } from './rich-blocks.js';

export interface ProjectProfile extends Revisioned, Timestamped {
  id: ProjectId;
  projectId: ProjectId;
  name: string;
  description?: RichBlockRef<'text'>;
  status: 'active' | 'paused' | 'completed' | 'archived';
  metadata: Metadata;
  createdBy: ActorId;
  updatedBy: ActorId;
}

export type ActiveDestination =
  | { kind: 'permanent'; destination: 'overview' | 'research' | 'analyze' }
  | { kind: 'tab'; tabId: EntityId<'workspace_tab'> };

export interface WorkspacePanelState {
  visible: boolean;
  width: number;
}

export interface WorkspaceTab {
  id: EntityId<'workspace_tab'>;
  resourceId: EntityId<ResourceKind>;
  rank: Rank;
  contextLens?: EntityId<'context'>;
  inspectorState: JsonObject;
  pinned: boolean;
  openedAt: ISODateTime;
  lastFocusedAt: ISODateTime;
}

export interface WorkspaceState extends PersistedRecord<'workspace_state'> {
  userId: UserId;
  activeDestination: ActiveDestination;
  panels: {
    context: WorkspacePanelState;
    inspector: WorkspacePanelState;
    [name: string]: WorkspacePanelState;
  };
  reopenPolicy: 'restore' | 'overview';
  tabs: WorkspaceTab[];
}

export interface ActivityResourceRef {
  kind: string;
  id: string;
  label: string;
  locator?: JsonObject;
}

/** Append-only human-legible fact, not resource revision history. */
export interface ActivityFact {
  id: EntityId<'activity_fact'>;
  projectId: ProjectId;
  idempotencyKey: string;
  inputDigest: Digest;
  actor: ActorRef;
  resource: ActivityResourceRef;
  action: string;
  resourceRevision?: number;
  changeId?: string;
  safeMetadata: Metadata;
  undoesActivityId?: EntityId<'activity_fact'>;
  occurredAt: ISODateTime;
  recordedAt: ISODateTime;
}

export interface ResourceAnchor {
  resourceKind: string;
  resourceId: string;
  /** Opaque to Comments; interpreted by the owning capability. */
  locator?: JsonObject;
}

export interface CommentThread extends PersistedRecord<'comment_thread'> {
  anchor: ResourceAnchor;
  status: 'open' | 'resolved';
  lifecycle: 'active' | 'deleted';
  resolvedAt?: ISODateTime;
  deletedAt?: ISODateTime;
}

export interface Comment extends PersistedRecord<'comment'> {
  threadId: EntityId<'comment_thread'>;
  /** Comments deliberately accept only the universal text block. */
  body: RichBlockRef<'text'>;
  lifecycle: 'active' | 'deleted';
  authorId: ActorId;
  deletedAt?: ISODateTime;
}

export type PresenceLocation =
  | { kind: 'project' }
  | {
      kind: 'resource';
      resourceKind: ResourceKind;
      resourceId: string;
      locator?: JsonObject;
    };

/** TTL-only current state. Expiry is not Activity. */
export interface PresenceLease {
  connectionId: EntityId<'presence_connection'>;
  projectId: ProjectId;
  actorId: ActorId;
  location: PresenceLocation;
  observedAt: ISODateTime;
  expiresAt: ISODateTime;
  metadata: Metadata;
}

/** Short-lived client invalidation/resume fact, not an audit log. */
export interface ChangeFeedEvent {
  sequence: number;
  projectId: ProjectId;
  capability: string;
  entityKind: string;
  entityId: string;
  entityRevision?: number;
  operation: string;
  actorId?: ActorId;
  safePayload: JsonObject;
  committedAt: ISODateTime;
}
