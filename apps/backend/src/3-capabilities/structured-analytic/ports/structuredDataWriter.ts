// The two ways an analytic becomes project data.
//
// `save` writes the compiled formula under a name, so the result stays live and
// moves when its sources move. `copy` writes the rows it resolved to right now,
// frozen. Both produce an ordinary Structured Data entry that any formula can
// reference — there is no analytic-shaped thing in the data model.

import type { AnalyticScalar } from "../domain/model.js";

export interface DeclaredEntry {
  readonly entryId: string;
  readonly displayName: string;
  readonly revision: number;
}

export interface StructuredDataWriter {
  /**
   * Declares a formula entry whose body is the compiled expression.
   *
   * Nothing is evaluated, so this cannot fail on data — a definition whose
   * sources are currently broken still saves, and starts working when they do.
   *
   * Throws `AnalyticNameConflictError` when the name is taken.
   */
  declareFormula(input: {
    readonly displayName: string;
    readonly description?: string;
    readonly body: string;
  }): Promise<DeclaredEntry>;

  /**
   * Declares a literal table from rows already resolved.
   *
   * The inverse trade from `declareFormula`: this one had to evaluate, so it
   * can fail on data — and what it writes never changes again.
   */
  declareTable(input: {
    readonly displayName: string;
    readonly description?: string;
    readonly fields: readonly string[];
    readonly rows: readonly (readonly AnalyticScalar[])[];
  }): Promise<DeclaredEntry>;
}
