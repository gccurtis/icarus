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
  /**
   * Catalog label, unique per kind. The only thing `template.update` renames:
   * the backing resource is sealed and its title is unreachable, so the catalog
   * cannot borrow it.
   */
  readonly name: string;
  /** Optional catalog annotation: what this template is for. */
  readonly description?: string;
  /**
   * The template's declared parameters. A template is a resource as a function
   * of its Context Variables, and this is that function's parameter list — part
   * of the record's identity, not a cache of resource state. The backing
   * resource separately holds each variable's applied target.
   */
  readonly contextBindings: TemplateContextBindings;
  readonly state: TemplateRecordState;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TemplateResourceRef {
  readonly kind: string;
  readonly resourceId: string;
}

export interface TemplateContextBinding {
  /**
   * What this parameter points at. Omitted means "explicitly unbind", not
   * "leave alone" — a binding key absent from the record inherits the source's
   * target instead.
   */
  readonly target?: ContextEntry;
  /**
   * Declaration only, and meaningful only at registration. The record is the
   * one place it can live: the backing resource has no field for it.
   */
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
  /** Who initiated this command. Kept out of the command digest. */
  readonly origin: TemplateOrigin;
  readonly command: TemplateCommand;
}

/** Matches Activity's vocabulary without a composition-time translation. */
export type TemplateOrigin = "user" | "agent" | "automation" | "system";

export type TemplateCommand =
  | {
      readonly type: "template.register";
      readonly source: TemplateResourceRef;
      /** Required: Templates cannot read the source's title to default from. */
      readonly name: string;
      readonly description?: string;
      /** Declared on the record and applied to the backing template. */
      readonly contextBindings: TemplateContextBindings;
    }
  | {
      /**
       * The only path that changes a registered template. Rewrites the catalog
       * declaration and applies content edits to the sealed backing resource in
       * one command, so the two cannot drift.
       */
      readonly type: "template.update";
      readonly templateId: string;
      readonly expectedRevision: number;
      /** Omitted means "leave alone"; supplied values replace wholesale. */
      readonly name?: string;
      readonly description?: string;
      readonly contextBindings?: TemplateContextBindings;
      /**
       * Content edits for the backing resource, opaque here. Only the owning
       * kind interprets them, exactly as with a binding target.
       */
      readonly resourceOperations?: unknown;
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
    }
  | {
      readonly type: "template.purge";
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
  | { readonly type: "template.updated"; readonly template: TemplateRecord }
  | { readonly type: "template.deleted"; readonly templateId: string; readonly revision: number }
  | { readonly type: "template.purged"; readonly templateId: string };

export interface TemplateQueryRequest {
  readonly query: TemplateQuery;
}

export type TemplateQuery =
  | { readonly type: "template.get"; readonly templateId: string }
  | { readonly type: "template.list"; readonly kind?: string }
  /**
   * The backing content, read through the adapter. Separate from `template.get`
   * so listing a catalog stays a single store read; needed at all because
   * registration seals the owning capability's own read surface.
   */
  | { readonly type: "template.load"; readonly templateId: string };

export type TemplateQueryResult =
  | { readonly type: "template.record"; readonly template: TemplateRecord }
  | { readonly type: "template.records"; readonly templates: readonly TemplateRecord[] }
  /** `content` is opaque: a Document snapshot for kind "document", and so on. */
  | {
      readonly type: "template.content";
      readonly template: TemplateRecord;
      readonly content: unknown;
    };

/** Templates' own activity vocabulary. Translated to Activity's in 1-init. */
export type TemplateTransactionKind =
  | "template.registered"
  | "template.updated"
  | "template.deleted";

export interface TemplateCommittedTransaction {
  readonly sourceTransactionId: string;
  readonly kind: TemplateTransactionKind;
  readonly templateId: string;
  readonly resourceKind: string;
  readonly resourceId: string;
  readonly actorId?: string;
  readonly origin: TemplateOrigin;
  readonly occurredAt: string;
}
