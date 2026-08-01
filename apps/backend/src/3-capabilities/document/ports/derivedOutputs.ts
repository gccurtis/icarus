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

export interface DocumentDerivedOutputs {
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
}
