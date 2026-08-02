import type {
  TemplateContextBindings,
  TemplateInstantiationInput
} from "../domain/model.js";

/**
 * One adapter per supported resource kind, supplied by composition. Templates
 * imports no capability; 1-init owns every adapter and the registry.
 *
 * Every method returns void. Templates supplies both the kind and the
 * destination identifier, so a successful call can only have produced the
 * resource it was told to produce and there is nothing to validate back.
 *
 * Applying the binding override rule is the adapter's job in both directions,
 * because only the owning kind knows how its variables are stored:
 *
 *   - a variable name absent from the record keeps the source's target;
 *   - a name present with `entry` takes that target;
 *   - a name present without `entry` is explicitly unbound.
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

  deleteTemplateCopy(input: {
    templateId: string;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface TemplateResourceRegistry {
  get(kind: string): TemplateResourceAdapter | undefined;
}
