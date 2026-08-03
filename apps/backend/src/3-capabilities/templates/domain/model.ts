// Templates canonical model.
//
// ContextEntry is a type-only import of the {id, kind} atom, matching the way
// Structured Data and Derived Outputs reference it. Templates has no Context
// runtime, port, read, or write: a binding target is an opaque pair that only
// the owning resource kind interprets.

import type { ContextEntry } from "#context";

export type { ContextEntry };

export interface TemplateRecord {
  /** Catalog identity, allocated by Templates and never supplied by a caller. */
  readonly id: string;
  readonly kind: string;
  /**
   * Address of the backing copy inside the owning capability's own storage.
   * Allocated there, not here — the capability that stores a resource names it.
   */
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
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A resource the owning capability has allocated. Only ever a *result* shape:
 * registration names its source with flat `kind` + `resourceId`, and
 * instantiation names no destination at all.
 */
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
      /**
       * The source is named flat rather than as a nested ref: `kind` selects the
       * runtime and `resourceId` addresses one of its resources, which are two
       * different jobs. Nesting them implied a shared identity they never had.
       */
      readonly type: "template.register";
      readonly kind: string;
      readonly resourceId: string;
      /** Required: Templates cannot read the source's title to default from. */
      readonly name: string;
      readonly description?: string;
      /** Declared on the record and applied to the backing copy. */
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
      /**
       * No destination identifier: the owning capability allocates the
       * instance's ID and hands it back, the same way it does for the backing
       * copy at registration.
       */
      readonly type: "template.instantiate";
      readonly templateId: string;
      /**
       * The new instance's own name. **Three different names meet here and none
       * of them is the same thing:**
       *
       *   - the Template record's `name` is the catalog label;
       *   - the sealed backing copy's title is inherited from the registration
       *     source and unreachable from either side;
       *   - this is what the instance is called.
       *
       * Omitted means the instance inherits the backing copy's title, which is
       * the only default available — nothing else describes this instance.
       */
      readonly name?: string;
      /**
       * Arguments for the declared parameters: every one of them, each with a
       * target. See `TemplateBindingMismatchError`.
       */
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

/**
 * `template.list` is the only template listing in the system — no resource
 * capability exposes one — so it has to work as a picker rather than as a dump:
 * narrow by kind, type-ahead over the two fields a person actually reads.
 */
export interface TemplateListFilter {
  /** Any-of. Omitted means every kind. */
  readonly kinds?: readonly string[];
  /** Case-insensitive substring over name and description. */
  readonly search?: string;
  readonly limit?: number;
  /** Opaque; only ever a `nextCursor` handed back by a previous page. */
  readonly cursor?: string;
}

export type TemplateQuery =
  | { readonly type: "template.get"; readonly templateId: string }
  | ({ readonly type: "template.list" } & TemplateListFilter)
  /**
   * The backing content, read through the resource. Separate from
   * `template.get` so listing a catalog stays a single store read; needed at all
   * because registration seals the owning capability's own read surface.
   */
  | { readonly type: "template.load"; readonly templateId: string };

export type TemplateQueryResult =
  | { readonly type: "template.record"; readonly template: TemplateRecord }
  | {
      readonly type: "template.records";
      readonly templates: readonly TemplateRecord[];
      /** Absent on the last page. */
      readonly nextCursor?: string;
    }
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
