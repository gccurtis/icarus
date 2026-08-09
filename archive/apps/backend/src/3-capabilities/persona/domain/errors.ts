export class PersonaNotFoundError extends Error {
  constructor(public readonly personaId: string) {
    super(`Persona '${personaId}' was not found`);
    this.name = "PersonaNotFoundError";
  }
}

export class PersonaConflictError extends Error {
  constructor(public readonly displayName: string) {
    super(`Persona '${displayName}' already exists`);
    this.name = "PersonaConflictError";
  }
}

export class StalePersonaRevisionError extends Error {
  constructor(
    public readonly personaId: string,
    public readonly expectedRevision: number,
    public readonly actualRevision: number
  ) {
    super(
      `Stale revision for persona ${personaId}: expected ${expectedRevision}, current ${actualRevision}`
    );
    this.name = "StalePersonaRevisionError";
  }
}

export class PersonaValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(`${field}: ${reason}`);
    this.name = "PersonaValidationError";
  }
}

/**
 * The built-in fallback is a code constant, not a row. Attempting to mutate it is
 * a caller error rather than a missing record, so it gets its own class.
 */
export class BuiltInPersonaImmutableError extends Error {
  constructor(public readonly personaId: string) {
    super(`Persona '${personaId}' is built in and cannot be modified`);
    this.name = "BuiltInPersonaImmutableError";
  }
}

export class PersonaWireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonaWireError";
  }
}
