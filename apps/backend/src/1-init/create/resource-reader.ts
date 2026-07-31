// ResourceReader stub — aggregates readers from Connector and General Files.
// Initially returns null for all reads. Individual capabilities register
// actual readers as they come online.

import type { ResourceReader, ResourceContent } from "#derived-outputs";

class StubResourceReader implements ResourceReader {
  async read(
    _resourceId: string,
    _resourceKind: string,
    _startLine: number,
    _endLine: number
  ): Promise<ResourceContent | null> {
    return null;
  }
}

export const createResourceReader = (): ResourceReader => {
  return new StubResourceReader();
};