import type {
  DeclareDerivedOutputOptions,
  DeclareDerivedOutputRequest,
  DerivedOutput,
  DerivedOutputRevision,
  DerivedRefreshResult,
  RefreshDerivedOutputOptions,
  UpdateDefinitionRequest,
  UpdateDerivedOutputDefinitionOptions
} from "#derived-outputs";

/**
 * Types-only, exactly as Document's is. Nothing here imports a runtime value
 * from Derived Outputs, which is what lets Slides identify that capability's
 * errors by name rather than by `instanceof` — see `isNotFound` in the service.
 */
export interface SlideDerivedOutputs {
  declare(
    request: DeclareDerivedOutputRequest,
    options?: DeclareDerivedOutputOptions
  ): Promise<DerivedOutput>;
  get(id: string): Promise<DerivedOutput | null>;
  getRevision(id: string, revision: number): Promise<DerivedOutputRevision | null>;
  updateDefinition(
    id: string,
    request: UpdateDefinitionRequest,
    options?: UpdateDerivedOutputDefinitionOptions
  ): Promise<DerivedOutput>;
  refresh(id: string, options?: RefreshDerivedOutputOptions): Promise<DerivedRefreshResult>;
  delete(id: string): Promise<void>;
  purge(id: string): Promise<void>;
}
