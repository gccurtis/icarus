export class ConnectorNotFoundError extends Error {
  public readonly code = "not_found" as const;

  constructor(id: string) {
    super(`Connector not found: ${id}`);
    this.name = "ConnectorNotFoundError";
  }
}

export class ConnectorAlreadyExistsError extends Error {
  public readonly code = "already_exists" as const;

  constructor(providerKind: string, locator: string) {
    super(`Connector already exists: ${providerKind}::${locator}`);
    this.name = "ConnectorAlreadyExistsError";
  }
}

export class UnsupportedLocatorError extends Error {
  public readonly code = "unsupported_locator" as const;

  constructor(message: string) {
    super(message);
    this.name = "UnsupportedLocatorError";
  }
}

export class SyncInProgressError extends Error {
  public readonly code = "sync_in_progress" as const;

  constructor(id: string) {
    super(`Sync already in progress for connector: ${id}`);
    this.name = "SyncInProgressError";
  }
}

export class ConnectorValidationError extends Error {
  public readonly code = "bad_request" as const;

  constructor(message: string) {
    super(message);
    this.name = "ConnectorValidationError";
  }
}
