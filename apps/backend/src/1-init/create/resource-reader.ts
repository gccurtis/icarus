import type { ConnectorEntry, ConnectorItemEntry, ConnectorService } from "#connector";
import type { ContextManager } from "#context";
import type {
  ResourceContent,
  ResourceDescriptor,
  ResourceReader
} from "#derived-outputs";
import type { GeneralFile, GeneralFileService } from "#general-files";
import type { Finding, InvestigationRuntime } from "#investigation";
import type { Logger } from "#platform/observability/logger.js";
import type {
  ContextEntry,
  KnowledgeResourceResolver,
  KnowledgeScopeManifest
} from "#platform/knowledge/types.js";

const GENERAL_FILE_SOURCE_PREFIX = "general-file:";
const CONNECTOR_SOURCE_PREFIX = "connector:";
const FINDING_SOURCE_PREFIX = "finding:";

const isGeneralFileKind = (kind: string): boolean =>
  kind.startsWith("general::file::") || kind === "general-file";

const isConnectorKind = (kind: string): boolean =>
  kind.startsWith("connector::") || kind === "connector-item";

const sliceLines = (text: string, startLine: number, endLine: number): string => {
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine
  ) {
    throw new Error("Invalid resource line range");
  }

  return text.split(/\r?\n/u).slice(startLine - 1, endLine).join("\n");
};

interface ConnectorSourceMatch {
  readonly entry: ConnectorEntry;
  readonly item?: ConnectorItemEntry;
}

/**
 * Mutable only during composition. Once startup registers the concrete
 * capabilities, callers use this object through the narrow ResourceReader and
 * KnowledgeResourceResolver interfaces.
 */
export type RuntimeResourceRegistry = ResourceReader &
  KnowledgeResourceResolver & {
    registerGeneralFiles(service: GeneralFileService): void;
    registerConnector(service: ConnectorService): void;
    registerInvestigation(runtime: InvestigationRuntime): void;
  };

class ResourceRegistry implements RuntimeResourceRegistry {
  private generalFiles?: GeneralFileService;
  private connector?: ConnectorService;
  private investigation?: InvestigationRuntime;

  constructor(
    private readonly contexts: ContextManager,
    private readonly logger: Logger
  ) {}

  registerGeneralFiles(service: GeneralFileService): void {
    this.generalFiles = service;
  }

  registerConnector(service: ConnectorService): void {
    this.connector = service;
  }

  registerInvestigation(runtime: InvestigationRuntime): void {
    this.investigation = runtime;
  }

  /** Expand nested Contexts, then map every known resource to Knowledge IDs. */
  async resolve(entries: ContextEntry[]): Promise<ContextEntry[]> {
    const leaves = await this.contexts.resolve(entries);
    const sourceIds = new Set<string>();

    for (const entry of leaves) {
      if (entry.kind === "document") {
        sourceIds.add(entry.id);
        continue;
      }

      const finding = await this.findFinding(entry.id, entry.kind);
      if (finding?.status === "accepted" && finding.knowledgeSourceId) {
        sourceIds.add(finding.knowledgeSourceId);
        continue;
      }

      const generalFile = this.findGeneralFile(entry.id, entry.kind);
      if (generalFile?.knowledgeSourceId) {
        sourceIds.add(generalFile.knowledgeSourceId);
        continue;
      }

      const connectorEntry = this.findConnectorEntry(entry.id, entry.kind);
      if (connectorEntry) {
        for (const sourceId of connectorEntry.knowledgeSourceIds) {
          sourceIds.add(sourceId);
        }
      }
    }

    const resolved = [...sourceIds]
      .sort()
      .map((id) => ({ id, kind: "document" }));

    this.logger.debug("resources.scope.resolve", {
      inputCount: entries.length,
      leafCount: leaves.length,
      sourceCount: resolved.length
    });
    return resolved;
  }

  async describeSource(sourceId: string): Promise<ResourceDescriptor | null> {
    const finding = await this.findFindingBySource(sourceId);
    if (finding) {
      return {
        sourceId,
        resourceId: finding.id,
        resourceKind: "finding"
      };
    }

    const generalFile = this.findGeneralFileBySource(sourceId);
    if (generalFile) {
      return {
        sourceId,
        resourceId: generalFile.id,
        resourceKind: generalFile.kind,
        resourceRevision: generalFile.revision
      };
    }

    const connectorMatch = this.findConnectorSource(sourceId);
    if (connectorMatch) {
      const { entry, item } = connectorMatch;
      return {
        sourceId,
        // Directory items need the source identity to remain unambiguous.
        resourceId: item ? sourceId : entry.id,
        resourceKind: entry.kind,
        resourceRevision: entry.revision
      };
    }

    return null;
  }

  async list(
    scope: KnowledgeScopeManifest
  ): Promise<readonly ResourceDescriptor[]> {
    return scope.resources.map((resource) => ({ ...resource }));
  }

  async read(
    resourceId: string,
    resourceKind: string,
    startLine: number,
    endLine: number,
    scope: KnowledgeScopeManifest
  ): Promise<ResourceContent | null> {
    const descriptor = scope.resources.find(
      (resource) =>
        resource.resourceId === resourceId &&
        resource.resourceKind === resourceKind
    );
    if (!descriptor) {
      this.logger.debug("resources.read.denied", { resourceId, resourceKind });
      return null;
    }

    const finding = await this.findFindingBySource(descriptor.sourceId);
    if (
      finding &&
      finding.id === descriptor.resourceId &&
      descriptor.resourceKind === "finding"
    ) {
      return {
        resourceId: finding.id,
        resourceKind: "finding",
        text: sliceLines(finding.claim, startLine, endLine),
        byteSize: Buffer.byteLength(finding.claim, "utf8")
      };
    }

    const generalFile = this.findGeneralFileBySource(descriptor.sourceId);
    if (
      generalFile?.knowledgeSourceId &&
      generalFile.id === descriptor.resourceId &&
      generalFile.kind === descriptor.resourceKind &&
      this.revisionMatches(generalFile.revision, descriptor)
    ) {
      return {
        resourceId: generalFile.id,
        resourceKind: generalFile.kind,
        revision: generalFile.revision,
        text: sliceLines(generalFile.content, startLine, endLine),
        byteSize: generalFile.byteSize
      };
    }

    const connectorMatch = this.findConnectorSource(descriptor.sourceId);
    if (!connectorMatch) return null;

    const { entry, item } = connectorMatch;
    const sourceId = item?.knowledgeSourceId ?? entry.knowledgeSourceIds[0];
    if (
      !sourceId ||
      sourceId !== descriptor.sourceId ||
      (item ? sourceId : entry.id) !== descriptor.resourceId ||
      entry.kind !== descriptor.resourceKind ||
      !this.revisionMatches(entry.revision, descriptor)
    ) return null;

    const reader = item
      ? await this.connector!.getDirectoryReader(entry.id).getItemReader(item.itemKey)
      : await this.connector!.getReader(entry.id);
    const lines = await reader.readLines(startLine, endLine);
    return {
      resourceId: item ? sourceId : entry.id,
      resourceKind: entry.kind,
      revision: entry.revision,
      text: lines.join("\n"),
      byteSize: item?.byteSize ?? reader.byteSize
    };
  }

  private revisionMatches(
    currentRevision: number,
    descriptor: ResourceDescriptor
  ): boolean {
    return descriptor.resourceRevision === undefined ||
      descriptor.resourceRevision === currentRevision;
  }

  private findGeneralFile(id: string, kind: string): GeneralFile | null {
    if (!this.generalFiles) return null;

    const canonicalId = id.startsWith(GENERAL_FILE_SOURCE_PREFIX)
      ? id.slice(GENERAL_FILE_SOURCE_PREFIX.length)
      : id;
    if (!isGeneralFileKind(kind) && !id.startsWith(GENERAL_FILE_SOURCE_PREFIX)) {
      return null;
    }

    try {
      return this.generalFiles.get(canonicalId);
    } catch {
      return null;
    }
  }

  private findGeneralFileBySource(sourceId: string): GeneralFile | null {
    if (!this.generalFiles) return null;
    if (sourceId.startsWith(GENERAL_FILE_SOURCE_PREFIX)) {
      try {
        return this.generalFiles.get(sourceId.slice(GENERAL_FILE_SOURCE_PREFIX.length));
      } catch {
        return null;
      }
    }

    const metadata = this.generalFiles
      .list()
      .find((file) => file.knowledgeSourceId === sourceId);
    if (!metadata) return null;
    try {
      return this.generalFiles.get(metadata.id);
    } catch {
      return null;
    }
  }

  private findConnectorEntry(id: string, kind: string): ConnectorEntry | null {
    if (!this.connector || (!isConnectorKind(kind) && !id.startsWith(CONNECTOR_SOURCE_PREFIX))) {
      return null;
    }
    if (id.startsWith(CONNECTOR_SOURCE_PREFIX)) {
      return this.findConnectorSource(id)?.entry ?? null;
    }
    try {
      return this.connector.get(id);
    } catch {
      return null;
    }
  }

  private findConnectorSource(sourceId: string): ConnectorSourceMatch | null {
    if (!this.connector) return null;
    const entry = this.connector
      .list()
      .find((candidate) => candidate.knowledgeSourceIds.includes(sourceId));
    if (!entry) return null;

    if (entry.kind.startsWith("connector::directory::")) {
      const item = this.connector
        .getDirectoryReader(entry.id)
        .listItems()
        .find((candidate) => candidate.knowledgeSourceId === sourceId);
      return item ? { entry, item } : null;
    }

    return { entry };
  }

  private async findFinding(id: string, kind: string): Promise<Finding | null> {
    if (!this.investigation || (kind !== "finding" && !id.startsWith(FINDING_SOURCE_PREFIX))) {
      return null;
    }
    const findingId = id.startsWith(FINDING_SOURCE_PREFIX)
      ? id.slice(FINDING_SOURCE_PREFIX.length)
      : id;
    try {
      return await this.investigation.getFinding(findingId);
    } catch {
      return null;
    }
  }

  private async findFindingBySource(sourceId: string): Promise<Finding | null> {
    if (!this.investigation || !sourceId.startsWith(FINDING_SOURCE_PREFIX)) {
      return null;
    }
    let finding: Finding | null;
    try {
      finding = await this.investigation.getFinding(
        sourceId.slice(FINDING_SOURCE_PREFIX.length)
      );
    } catch {
      return null;
    }
    return finding?.status === "accepted" && finding.knowledgeSourceId === sourceId
      ? finding
      : null;
  }
}

export const createResourceReader = (
  contexts: ContextManager,
  logger: Logger
): RuntimeResourceRegistry => new ResourceRegistry(contexts, logger);
