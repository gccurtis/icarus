import type { FormulaResolverSnapshot } from "#formula";

export interface DocumentFormulaResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
}
