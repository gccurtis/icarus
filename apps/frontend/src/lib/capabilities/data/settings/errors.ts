/**
 * The error Settings raises, and the codes it raises it with.
 *
 * At the capability root rather than in `types/` because a consumer catching one
 * is using the public contract. A code is a decision this capability made and
 * states; anything thrown without one is a fault, and the two are recorded
 * differently.
 */
export type SettingsErrorCode = "invalid-key" | "invalid-value" | "setting-not-found";

export class SettingsError extends Error {
  constructor(
    readonly code: SettingsErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SettingsError";
  }
}
