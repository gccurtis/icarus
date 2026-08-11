// The narrow slice of Context that Persona consumes.
//
// Satisfied structurally by ContextManager, which has many more methods. Persona
// states exactly what it uses: it manages one private wrapper record per persona
// and never reads Context for any other reason. There is deliberately no get(),
// resolve(), combine(), or list() here — expanding a context reference into
// retrievable content is the consumer's job, not Persona's.
//
// There is also no update(). A changed context is never applied by mutating the
// existing wrapper in place — Persona always declares a brand-new wrapper and,
// once its own record's CAS write has committed to the new wrapper, deletes the
// old one. A fresh declare() can never itself go stale (it always starts at
// revision 1), which is what makes this ordering immune to the partial-write
// gap described in docs/invariants.md: either side losing its race leaves, at
// worst, one harmless orphaned wrapper — never a persona record pointing at a
// stale or missing one.

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
  delete(id: string): Promise<void>;
  purge(id: string): Promise<void>;
}
