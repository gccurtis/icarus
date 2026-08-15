/** Deferred Taurus concepts retained so reintroduction does not distort core types. */

import type { ResourceRecord } from './authored-resources.js';
import type {
  ContentSourceRef,
  EntityId,
  Frame,
  ISODateTime,
  JsonObject,
  OrderedChild,
  PersistedRecord,
  Rank,
} from './core.js';
import type { BlockPlacement, RichBlockRef } from './rich-blocks.js';

export interface BoardLayer extends OrderedChild<'board_layer'> {
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface BoardElementBase<Kind extends string> {
  id: EntityId<'board_element'>;
  kind: Kind;
  layerId: EntityId<'board_layer'>;
  parentGroupId?: EntityId<'board_element'>;
  zRank: Rank;
  locked: boolean;
  visible: boolean;
}

export interface BoardGroupElement extends BoardElementBase<'group'> {
  name?: string;
}

export interface BoardVisualElement extends BoardElementBase<'visual'> {
  frame: Frame;
  rotation: number;
  blocks: Array<BlockPlacement<{ frame?: Frame; fit?: 'contain' | 'cover' | 'fill' }>>;
}

export interface BoardConnectorElement extends BoardElementBase<'connector'> {
  from: { elementId?: EntityId<'board_element'>; x: number; y: number };
  to: { elementId?: EntityId<'board_element'>; x: number; y: number };
  label?: RichBlockRef<'text'>;
  style?: JsonObject;
}

export type BoardElement =
  | BoardGroupElement
  | BoardVisualElement
  | BoardConnectorElement;

export interface BoardState {
  mode: 'whiteboard' | 'dashboard';
  canvasSettings: JsonObject;
  dashboardSettings?: JsonObject;
  theme: JsonObject;
  layers: BoardLayer[];
  elements: BoardElement[];
}

export type Board = ResourceRecord<'board', BoardState>;

export interface MemoryEntry extends PersistedRecord<'memory_entry'> {
  scope: JsonObject;
  kind: string;
  content: RichBlockRef<'text'>;
  evidence: ContentSourceRef[];
  confidence: number;
  state: 'candidate' | 'active' | 'challenged' | 'superseded' | 'expired' | 'deleted';
  sensitivity: string;
  sourceKind: string;
  activationRule: JsonObject;
  reviewAt?: ISODateTime;
  expiresAt?: ISODateTime;
  lastConsultedAt?: ISODateTime;
}

export interface MemoryConsultation {
  id: EntityId<'memory_consultation'>;
  memoryId: EntityId<'memory_entry'>;
  consumerKind: string;
  consumerId: string;
  contextDigest: string;
  outcome: string;
  consultedAt: ISODateTime;
}
