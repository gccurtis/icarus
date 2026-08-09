export class GeneralFileNotFoundError extends Error {
  public readonly code = "not_found" as const;

  constructor(id: string) {
    super(`General file not found: ${id}`);
    this.name = "GeneralFileNotFoundError";
  }
}

export class GeneralFileEncodingError extends Error {
  public readonly code = "encoding_error" as const;

  constructor(message: string) {
    super(message);
    this.name = "GeneralFileEncodingError";
  }
}