// The narrow slice of Context that Persona consumes.
//
// Satisfied structurally by ContextManager, which has many more methods. Persona
// states exactly what it uses: it manages one private wrapper record per persona
// and never reads Context for any other reason. There is deliberately no get(),
// resolve(), combine(), or list() here — expanding a context reference into
// retrievable content is the consumer's job, not Persona's.

import type { ContextEntry } from "../domain/model.js";

export interface PersonaContextRecordRef {
  readonly id: string;
  readonly revision: number;
}

export interface PersonaContextPort {
  declare(
    displayName: string,
    entries: ContextEntry[],
    options?: { readonly description?: string; readonly private?: boolean }
  ): Promise<PersonaContextRecordRef>;
  update(
    id: string,
    entries: ContextEntry[],
    expectedRevision: number
  ): Promise<PersonaContextRecordRef>;
  delete(id: string): Promise<void>;
}
