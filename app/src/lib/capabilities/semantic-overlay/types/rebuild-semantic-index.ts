export type RebuildSemanticIndexInput = Record<string, never>;

export type RebuildSemanticIndexResult = {
  readonly indexId: string;
  readonly objectCount: number;
  readonly nodeCount: number;
  readonly rootCount: number;
};
