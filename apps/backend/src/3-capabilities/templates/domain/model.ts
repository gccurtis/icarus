// Templates canonical model.
//
// ContextEntry is a type-only import of the {id, kind} atom, matching the way
// Structured Data and Derived Outputs reference it. Templates has no Context
// runtime, port, read, or write: a binding target is an opaque pair that only
// the owning resource kind interprets.

import type { ContextEntry } from "#context";

export type { ContextEntry };

/** A template is 'reserving' between ID allocation and a completed copy. */
export type TemplateRecordState = "reserving" | "ready";

export interface TemplateRecord {
  /** Catalog identity, allocated by Templates and never supplied by a caller. */
  readonly id: string;
  readonly kind: string;
  /** Address of the backing copy. In version 1 this equals `id`. */
  readonly resourceId: string;
  /** Optional catalog annotation: what this template is for. */
  readonly description?: string;
  readonly state: TemplateRecordState;
  readonly createdAt: string;
  readonly deletedAt?: string;
}

export interface TemplateResourceRef {
  readonly kind: string;
  readonly resourceId: string;
}

export interface TemplateContextBinding {
  /**
   * Omitted means "explicitly unbind", not "leave alone". A binding key that is
   * absent from the record inherits the source's target instead.
   */
  readonly entry?: ContextEntry;
  /** Template documentation. Never written into destination resource state. */
  readonly description?: string;
}

/**
 * Variable name -> binding. Always a record by the time it leaves the decoder;
 * an omitted wire field and `{}` mean the same thing.
 */
export type TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>;

export interface TemplateInstantiationInput {
  /** Omitted means the instance keeps the backing template's title. */
  readonly title?: string;
  readonly contextBindings: TemplateContextBindings;
}

export interface TemplateCommandRequest {
  readonly requestId: string;
  readonly command: TemplateCommand;
}

export type TemplateCommand =
  | {
      readonly type: "template.register";
      readonly source: TemplateResourceRef;
      readonly description?: string;
      /** Defaults recorded on the backing template. */
      readonly contextBindings: TemplateContextBindings;
    }
  | {
      readonly type: "template.instantiate";
      readonly templateId: string;
      readonly destinationResourceId: string;
      readonly title?: string;
      /** Overrides applied over the template's defaults. */
      readonly contextBindings: TemplateContextBindings;
    }
  | {
      readonly type: "template.delete";
      readonly templateId: string;
    };

export type TemplateCommandType = TemplateCommand["type"];

export type TemplateCommandResult =
  | { readonly type: "template.registered"; readonly template: TemplateRecord }
  | {
      readonly type: "template.instantiated";
      readonly template: TemplateRecord;
      readonly resource: TemplateResourceRef;
    }
  | { readonly type: "template.deleted"; readonly templateId: string };

export interface TemplateQueryRequest {
  readonly query: TemplateQuery;
}

export type TemplateQuery =
  | { readonly type: "template.get"; readonly templateId: string }
  | { readonly type: "template.list"; readonly kind?: string };

export type TemplateQueryResult =
  | { readonly type: "template.record"; readonly template: TemplateRecord }
  | { readonly type: "template.records"; readonly templates: readonly TemplateRecord[] };

/** Templates' own activity vocabulary. Translated to Activity's in 1-init. */
export type TemplateFactKind = "template.registered" | "template.deleted";

export interface TemplateCommittedFact {
  readonly factId: string;
  readonly kind: TemplateFactKind;
  readonly templateId: string;
  readonly resourceKind: string;
  readonly resourceId: string;
  readonly actorId?: string;
  readonly occurredAt: string;
}

export interface TemplateOptions {
  readonly maxTemplatesPerProject: number;
}

export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  maxTemplatesPerProject: 500
};
