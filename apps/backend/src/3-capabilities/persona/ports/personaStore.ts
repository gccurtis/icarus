// Durable project-local storage owned by Persona.
// Promise-returning, matching the other layered capabilities.

import type { PersonaRecord } from "../domain/model.js";

export interface PersonaStore {
  get(id: string): Promise<PersonaRecord | undefined>;
  /** Case-insensitive over live records, matching the partial unique index. */
  getByName(displayName: string): Promise<PersonaRecord | undefined>;
  /** Live records only, name-sorted. */
  list(): Promise<PersonaRecord[]>;
  countLive(): Promise<number>;

  insert(record: PersonaRecord): Promise<void>;
  /** Compare-and-swap on revision. False means the caller was stale. */
  update(record: PersonaRecord, expectedRevision: number): Promise<boolean>;
  /** Archives the final snapshot and removes current state. False means stale. */
  delete(record: PersonaRecord, expectedRevision: number, deletedAt: string): Promise<boolean>;
  latestSnapshot(id: string): Promise<PersonaRecord | undefined>;
  purge(id: string): Promise<void>;
  pruneHistory(cutoff: string): Promise<number>;
  expiredDeleted(cutoff: string): Promise<string[]>;
}
