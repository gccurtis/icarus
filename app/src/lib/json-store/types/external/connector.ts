/**
 * Which service a connector reads from.
 *
 * A closed union: adding a member is a widening change, and a `switch` over
 * providers stops compiling the moment one is added — which is correct, since
 * adding a provider means writing a reader for it.
 *
 * SharePoint and OneDrive are one entry: the same drive API.
 */
export type ConnectorProvider = "microsoftGraph" | "googleDrive" | "dropbox" | "notion" | "s3";

export type ConnectorStatus = "connected" | "expired" | "revoked" | "error";

/**
 * An authorization, as one nested field rather than four loose ones — a read
 * model omits one name instead of remembering four.
 *
 * `secret` is the whole token blob as a unit, because providers return different
 * things inside it. `expiresAt` and `scopes` stay outside the ciphertext: a
 * refresh scheduler should not have to decrypt to learn when, and what was
 * granted is not secret.
 *
 * The key that encrypts `secret` is never a row. `keyVersion` is what lets a
 * rotation proceed one row at a time.
 */
export type ConnectorCredential = {
  /** Ciphertext. */
  secret: string;
  keyVersion: number;
  expiresAt?: number;
  scopes: string[];
};

/** A connection's read state — the only place a read failure can be recorded. */
export type ConnectionStatus = "live" | "missing" | "unreadable" | "error";
