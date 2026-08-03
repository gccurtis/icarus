import type { TemplateContextBindings } from "../domain/model.js";

/**
 * What a resource capability must be able to do for Templates to make templates
 * out of it. Not an adapter: there is no object implementing this by hand in
 * `1-init`. The resource capability's own runtime satisfies it **structurally**,
 * and composition is one line —
 *
 * ```ts
 * templateResources.register(document);
 * ```
 *
 * The interface exists so that line typechecks. Without it the registry would be
 * `Record<string, any>` and a missing or renamed method would surface at runtime
 * as "undefined is not a function" inside a serial job. Typing the registry as
 * `DocumentCapability` is the other alternative and fails twice over: Templates
 * would import a capability, and the registry could never hold a second kind.
 *
 * Same pattern as `ContextManager` satisfying `PersonaContextPort`.
 *
 * **Templates supplies no identifiers it does not own.** The capability that
 * stores a resource allocates its ID, so `duplicate` returns the ID it chose and
 * every other method is addressed by that ID rather than by a Template ID.
 *
 * **Registration seals the resource.** The owning capability must refuse its
 * whole public surface for a resource in template mode, reads included. These
 * methods are how Templates reaches past that refusal, so an implementation is
 * expected to use its own internal path rather than the public one.
 */
export interface TemplatableResource {
  /**
   * The registry key. A kind may be compound — `slides::deck` and
   * `slides::slide` are two kinds satisfied by one runtime, following
   * Connector's `connector::file::text` convention.
   */
  readonly kind: string;

  /**
   * A pure copy: new ID, same content. It knows nothing about templates and
   * applies no bindings, which is what keeps it reusable — a capability may
   * offer duplication for its own reasons — and what makes registration and
   * instantiation the same call with different follow-up.
   */
  duplicate(input: {
    sourceResourceId: string;
    /**
     * What to call the copy. Omitted keeps the source's own name, whatever the
     * kind calls that field — Document maps this to its title.
     *
     * Registration never supplies one: a backing copy is not something a user
     * names, and its inherited title is sealed with it. Instantiation always
     * may, because the instance is the user's.
     */
    name?: string;
    idempotencyKey: string;
  }): Promise<{ resourceId: string }>;

  /** Seals the resource: private, unreachable through its own endpoints. One-way. */
  markAsTemplate(input: { resourceId: string }): Promise<void>;

  /**
   * Binds the resource's own context variables by name:
   *
   *   - a name absent from the record keeps the resource's current target;
   *   - a name present with `target` takes that target;
   *   - a name present without `target` is explicitly unbound.
   *
   * Typed rather than folded into `submit` because only the owning kind knows
   * what a variable operation looks like, and Templates holds these in its own
   * decoded vocabulary. Handing them over unchanged is a pass-through; turning
   * them into operations would be a translation Templates cannot make.
   */
  applyBindings(input: {
    resourceId: string;
    contextBindings: TemplateContextBindings;
    idempotencyKey: string;
  }): Promise<void>;

  /**
   * Content edits, opaque here. `unknown` is right because the *caller* authored
   * this payload and the owning kind interprets it — the same reason a binding
   * target is an opaque `{ id, kind }` pair.
   */
  submit(input: {
    resourceId: string;
    operations: unknown;
    idempotencyKey: string;
  }): Promise<void>;

  /**
   * Reads the resource. Returns `unknown` for the same reason `submit` accepts
   * it: a template's content is whatever its kind says it is, and Templates
   * grows no per-kind types. The caller knows the kind from the record.
   */
  load(input: { resourceId: string }): Promise<unknown>;

  logicalDelete(input: { resourceId: string; idempotencyKey: string }): Promise<void>;
  purge(input: { resourceId: string; idempotencyKey: string }): Promise<void>;
}

export interface TemplatableResourceRegistry {
  get(kind: string): TemplatableResource | undefined;
}
