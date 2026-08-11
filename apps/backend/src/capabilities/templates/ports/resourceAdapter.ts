import type {
  TemplateContextBindings,
  TemplateInstantiationInput
} from "../domain/model.js";

/**
 * One adapter per supported resource kind, supplied by composition. Templates
 * imports no capability; initialization owns every adapter and the registry.
 *
 * Every *mutating* method returns void. Templates supplies both the kind and the
 * destination identifier, so a successful call can only have produced the
 * resource it was told to produce and there is nothing to validate back — which
 * is why there is no resource-mismatch error.
 *
 * `readTemplateCopy` is the exception and narrows that rule rather than keeping
 * it: a read has to return something. It returns `unknown`, because a template's
 * content is whatever the owning kind says it is and Templates grows no per-kind
 * types. The caller knows the kind from the Template record.
 *
 * Registration seals the backing resource: the owning capability must refuse its
 * whole public surface for a template-mode resource, reads included. These
 * methods are how Templates reaches past that refusal, so an adapter is expected
 * to use its capability's internal command path rather than the public one.
 *
 * Applying the binding override rule is the adapter's job in both directions,
 * because only the owning kind knows how its variables are stored:
 *
 *   - a variable name absent from the record keeps the source's target;
 *   - a name present with `target` takes that target;
 *   - a name present without `target` is explicitly unbound.
 */
export interface TemplateResourceAdapter {
  readonly kind: string;

  /** Copies a normal resource into a template-mode copy at `templateId`. */
  createTemplateCopy(input: {
    sourceResourceId: string;
    templateId: string;
    /** Defaults recorded on the template. */
    contextBindings: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<void>;

  /** Copies a template-mode resource into a normal resource. */
  instantiateTemplate(input: {
    templateId: string;
    destinationResourceId: string;
    instantiation: TemplateInstantiationInput;
    idempotencyKey: string;
  }): Promise<void>;

  /**
   * Applies content edits to a template-mode resource, and the declared
   * bindings when they changed. The only path to editing a sealed backing copy.
   */
  updateTemplateCopy(input: {
    templateId: string;
    /** Opaque to Templates; the owning kind interprets it. */
    operations: unknown;
    contextBindings?: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<void>;

  /** Reads a template-mode resource's content. No idempotency key: it is a read. */
  readTemplateCopy(input: { templateId: string }): Promise<unknown>;

  logicalDeleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;

  purgeTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface TemplateResourceRegistry {
  get(kind: string): TemplateResourceAdapter | undefined;
}
