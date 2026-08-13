/**
 * The tables owned by backend capabilities.
 *
 * Capabilities augment this interface beside their capability-owned schemas.
 * Keeping the database type at the runtime boundary ensures all of them use the
 * same client without moving table ownership into Platform Persistence.
 */
export interface BackendDatabase {}
