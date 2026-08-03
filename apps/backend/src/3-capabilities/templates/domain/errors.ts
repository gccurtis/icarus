export class TemplateWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateWireError";
  }
}

export class TemplateNotFoundError extends Error {
  constructor(public readonly templateId: string) {
    super(`Template '${templateId}' was not found`);
    this.name = "TemplateNotFoundError";
  }
}

export class TemplateAlreadyExistsError extends Error {
  constructor(public readonly templateId: string) {
    super(`Template '${templateId}' already exists`);
    this.name = "TemplateAlreadyExistsError";
  }
}

export class TemplateUnsupportedKindError extends Error {
  constructor(public readonly kind: string) {
    super(`No resource runtime is registered for kind '${kind}'`);
    this.name = "TemplateUnsupportedKindError";
  }
}

/**
 * `templateName`, not `name`: a parameter property called `name` would be
 * clobbered by the `this.name` assignment every error class in this file makes,
 * silently losing the value the caller needs.
 */
export class TemplateNameConflictError extends Error {
  constructor(
    public readonly kind: string,
    public readonly templateName: string
  ) {
    super(`A '${kind}' template named '${templateName}' already exists`);
    this.name = "TemplateNameConflictError";
  }
}

/**
 * Instantiation must name exactly the parameters the template declares.
 *
 * Missing keys are rejected because a partial instantiation would produce a
 * resource with an unbound variable — a prompt grounded on nothing, which fails
 * later and further from the cause. Unexpected keys are rejected for the
 * converse reason: a variable the template did not declare is not a parameter,
 * it is baked-in content, and binding it would edit the instance rather than
 * configure it.
 */
export class TemplateBindingMismatchError extends Error {
  constructor(
    public readonly templateId: string,
    public readonly missing: readonly string[],
    public readonly unexpected: readonly string[]
  ) {
    super(
      [
        `Template '${templateId}' bindings do not match its declaration`,
        missing.length > 0 ? `missing: ${missing.join(", ")}` : "",
        unexpected.length > 0 ? `not declared: ${unexpected.join(", ")}` : ""
      ]
        .filter((part) => part.length > 0)
        .join("; ")
    );
    this.name = "TemplateBindingMismatchError";
  }
}

export class StaleTemplateRevisionError extends Error {
  constructor(
    public readonly templateId: string,
    public readonly expectedRevision: number,
    public readonly actualRevision: number
  ) {
    super(
      `Template '${templateId}' is at revision ${actualRevision}, not ${expectedRevision}`
    );
    this.name = "StaleTemplateRevisionError";
  }
}

export class InvalidTemplateCursorError extends Error {
  constructor() {
    super("Template list cursor is not valid");
    this.name = "InvalidTemplateCursorError";
  }
}

export class TemplateIdempotencyMismatchError extends Error {
  constructor(public readonly requestId: string) {
    super(`Template request '${requestId}' was reused with different content`);
    this.name = "TemplateIdempotencyMismatchError";
  }
}
