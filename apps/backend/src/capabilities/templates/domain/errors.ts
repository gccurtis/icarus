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
    super(`No template adapter is registered for resource kind '${kind}'`);
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

export class TemplateIdempotencyMismatchError extends Error {
  constructor(public readonly requestId: string) {
    super(`Template request '${requestId}' was reused with different content`);
    this.name = "TemplateIdempotencyMismatchError";
  }
}
