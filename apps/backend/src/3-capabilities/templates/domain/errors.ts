export class TemplateWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateWireError";
  }
}

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateValidationError";
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

export class TemplateIdempotencyMismatchError extends Error {
  constructor(public readonly requestId: string) {
    super(`Template request '${requestId}' was reused with different content`);
    this.name = "TemplateIdempotencyMismatchError";
  }
}

export class TemplateCatalogLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Template catalog limit of ${limit} has been reached`);
    this.name = "TemplateCatalogLimitError";
  }
}
