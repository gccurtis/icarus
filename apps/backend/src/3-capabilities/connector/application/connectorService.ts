// ConnectorService — application logic for Connector capability.

import { createHash } from "node:crypto";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { AddResult } from "#platform/knowledge/types.js";
import type { Logger } from "#platform/observability/logger.js";
import { ConnectorAlreadyExistsError, ConnectorNotFoundError, SyncInProgressError } from "../domain/errors.js";
import {
  PROSE_TEXT_EXTENSIONS,
  type ConnectorEntry,
  type ConnectorItemEntry,
  type ConnectorKind,
  type ConnectorSyncConfig,
  type ItemIndexResult,
  type RegisterConnectorRequest,
  type RegisterConnectorResult,
} from "../domain/model.js";
import type { ConnectorProvider, SyncConnectorProvider } from "../domain/provider.js";
import type { ConnectorReader, DirectoryReader } from "../domain/reader.js";
import type { ConnectorStore } from "../ports/repository.js";

function connectorId(providerKind: string, locator: string): string {
  const canonical = `${providerKind}::${locator}`;
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Derive a stable Knowledge source ID. Sub-identifiers are hashed before
 * inclusion to avoid issues with arbitrary filenames/URLs/keys.
 */
function connectorKnowledgeSourceId(entryId: string, itemKey: string): string {
  const subHash = createHash("sha256").update(itemKey, "utf8").digest("hex");
  return `connector:${entryId}:${subHash}`;
}

function determineKind(items: Array<{ status: "prose" | "other" }>): ConnectorKind {
  const hasProse = items.some(i => i.status === "prose");
  const isSingle = items.length === 1;
  if (isSingle) {
    return hasProse ? "connector::file::text" : "connector::file::other";
  }
  return hasProse ? "connector::directory::text" : "connector::directory::other";
}

function classifyExtension(ext: string | null): "prose" | "other" {
  return ext && PROSE_TEXT_EXTENSIONS.has(ext) ? "prose" : "other";
}

export interface ConnectorService {
  register(request: RegisterConnectorRequest): Promise<RegisterConnectorResult>;
  sync(connectorId: string): Promise<void>;
  get(id: string): ConnectorEntry;
  list(): ConnectorEntry[];
  delete(id: string): void;
  getReader(id: string): Promise<ConnectorReader>;
  getDirectoryReader(id: string): DirectoryReader;
}

export function createConnectorService(
  store: ConnectorStore,
  knowledge: Knowledge,
  providers: Map<string, ConnectorProvider>,
  logger: Logger,
): ConnectorService {
  function getProvider(kind: string): ConnectorProvider {
    const provider = providers.get(kind);
    if (!provider) throw new Error(`Unknown provider: ${kind}`);
    return provider;
  }

  const now = (): string => new Date().toISOString();

  return {
    async register(request: RegisterConnectorRequest): Promise<RegisterConnectorResult> {
      const { providerKind, locator, syncInterval } = request;
      const provider = getProvider(providerKind);

      // Check for existing
      const existing = store.getByProviderAndLocator(providerKind, locator);
      if (existing) {
        return {
          status: "already_exists",
          entry: existing,
          indexResults: store.getItems(existing.id).map(item => ({
            itemKey: item.itemKey,
            name: item.name,
            status: item.status === "prose" ? "indexed" : "stored",
          })),
        };
      }

      // List items via provider
      const items = await provider.listItems(locator);

      // Determine kind
      const kind = determineKind(items.map(i => ({ status: classifyExtension(i.extension) })));

      const entryId = connectorId(providerKind, locator);
      const createdAt = now();
      const label = locator;

      // Build sync config if applicable
      let syncConfig: ConnectorSyncConfig | null = null;
      if ("syncType" in provider && (provider as SyncConnectorProvider).syncType === "scheduled" && syncInterval) {
        syncConfig = { syncType: "scheduled", interval: syncInterval };
      }

      const indexResults: ItemIndexResult[] = [];
      const entryItems: ConnectorItemEntry[] = [];
      const knowledgeSourceIds: string[] = [];

      for (const item of items) {
        const ext = item.extension ?? "";
        const itemStatus = classifyExtension(ext);

        if (itemStatus === "prose") {
          const sourceId = connectorKnowledgeSourceId(entryId, item.key);
          const reader = await provider.getReader(locator, item.key);

          logger.debug("connector.register.admitting", { entryId, itemKey: item.key, sourceId });

          const knowledgeResult: AddResult = await knowledge.add({
            sourceId,
            label: "connector-item",
            revision: item.revisionToken,
            text: await reader.readAll(),
          });

          knowledgeSourceIds.push(sourceId);

          entryItems.push({
            itemKey: item.key,
            name: item.name,
            extension: ext,
            byteSize: item.byteSize,
            revisionToken: item.revisionToken,
            lastModifiedAt: now(), // will be updated on first sync
            status: "prose",
            knowledgeSourceId: sourceId,
          });

          indexResults.push({
            itemKey: item.key,
            name: item.name,
            status: "indexed",
            knowledge: knowledgeResult,
          });
        } else {
          entryItems.push({
            itemKey: item.key,
            name: item.name,
            extension: ext,
            byteSize: item.byteSize,
            revisionToken: item.revisionToken,
            lastModifiedAt: now(),
            status: "other",
            knowledgeSourceId: null,
          });

          indexResults.push({
            itemKey: item.key,
            name: item.name,
            status: "stored",
          });
        }
      }

      const entry: ConnectorEntry = {
        id: entryId,
        kind,
        providerKind,
        locator,
        label,
        revision: 1,
        syncConfig,
        syncing: false,
        knowledgeSourceIds,
        createdAt,
        updatedAt: createdAt,
      };

      store.insert(entry, entryItems);

      logger.info("connector.register", { id: entryId, kind, providerKind, itemCount: items.length });

      return { status: "registered", entry, indexResults };
    },

    async sync(connectorId: string): Promise<void> {
      const entry = store.getById(connectorId);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(connectorId);
      }

      // syncing should already be set by the enqueue-time guard.
      if (!entry.syncing) {
        const acquired = store.setSyncing(connectorId);
        if (!acquired) {
          throw new SyncInProgressError(connectorId);
        }
      }

      logger.info("connector.sync.starting", { id: connectorId, kind: entry.kind, providerKind: entry.providerKind });

      try {
        const provider = getProvider(entry.providerKind);

        // Re-list all current items from the provider
        const currentItems = await provider.listItems(entry.locator);
        const existingItems = store.getItems(connectorId);
        const existingMap = new Map(existingItems.map(i => [i.itemKey, i]));
        const currentKeys = new Set(currentItems.map(i => i.key));

        const newEntries: ConnectorItemEntry[] = [];
        const knowledgeSourceIds: string[] = [...entry.knowledgeSourceIds];
        let changedCount = 0;
        let addedCount = 0;
        let removedCount = 0;

        // Process current items: add new, update changed
        for (const item of currentItems) {
          const ext = item.extension ?? "";
          const itemStatus = classifyExtension(ext);
          const existing = existingMap.get(item.key);

          if (!existing) {
            // New item
            addedCount++;
            let sourceId: string | null = null;

            if (itemStatus === "prose") {
              sourceId = connectorKnowledgeSourceId(connectorId, item.key);
              const reader = await provider.getReader(entry.locator, item.key);
              logger.debug("connector.sync.admitting-new", { connectorId, itemKey: item.key, sourceId });
              await knowledge.add({
                sourceId,
                label: "connector-item",
                revision: item.revisionToken,
                text: await reader.readAll(),
              });
              knowledgeSourceIds.push(sourceId);
            }

            newEntries.push({
              itemKey: item.key,
              name: item.name,
              extension: ext,
              byteSize: item.byteSize,
              revisionToken: item.revisionToken,
              lastModifiedAt: now(),
              status: itemStatus,
              knowledgeSourceId: sourceId,
            });
          } else if (existing.revisionToken !== item.revisionToken) {
            // Changed item
            changedCount++;
            let sourceId = existing.knowledgeSourceId;

            if (itemStatus === "prose") {
              if (!sourceId) {
                sourceId = connectorKnowledgeSourceId(connectorId, item.key);
                knowledgeSourceIds.push(sourceId);
              }
              const reader = await provider.getReader(entry.locator, item.key);
              logger.debug("connector.sync.updating", { connectorId, itemKey: item.key, sourceId });
              await knowledge.add({
                sourceId,
                label: "connector-item",
                revision: item.revisionToken,
                text: await reader.readAll(),
              });
            }

            newEntries.push({
              ...existing,
              revisionToken: item.revisionToken,
              lastModifiedAt: now(),
              status: itemStatus,
              knowledgeSourceId: sourceId,
            });
          } else {
            // Unchanged — carry forward
            newEntries.push(existing);
          }
        }

        // Remove items no longer on disk
        for (const existing of existingItems) {
          if (!currentKeys.has(existing.itemKey)) {
            removedCount++;
            if (existing.knowledgeSourceId) {
              await knowledge.remove(existing.knowledgeSourceId).catch(err => {
                logger.warn("connector.sync.remove-knowledge-failed", {
                  connectorId,
                  itemKey: existing.itemKey,
                  error: String(err),
                });
              });
            }
          }
        }

        // Remove stale knowledge source IDs from entries no longer in the index
        const currentSourceIds = new Set(
          newEntries
            .filter(e => e.knowledgeSourceId)
            .map(e => e.knowledgeSourceId as string)
        );
        const cleanedKnowledgeSourceIds = knowledgeSourceIds.filter(id => currentSourceIds.has(id));

        // Recompute kind based on new items
        const newKind = determineKind(newEntries.map(e => ({ status: e.status })));

        const updatedEntry: ConnectorEntry = {
          ...entry,
          kind: newKind,
          revision: entry.revision + 1,
          knowledgeSourceIds: cleanedKnowledgeSourceIds,
          updatedAt: now(),
        };
        store.update(updatedEntry, newEntries);

        if (entry.syncConfig) {
          store.updateSyncTimestamp(connectorId, now());
        }

        logger.info("connector.sync.complete", {
          id: connectorId,
          kind: newKind,
          items: newEntries.length,
          added: addedCount,
          changed: changedCount,
          removed: removedCount,
        });
      } finally {
        store.clearSyncing(connectorId);
      }
    },

    get(id: string): ConnectorEntry {
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }
      return entry;
    },

    list(): ConnectorEntry[] {
      return store.listAll();
    },

    delete(id: string): void {
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }

      const deletedAt = now();

      // Remove Knowledge sources for prose items
      const items = store.getItems(id);
      for (const item of items) {
        if (item.knowledgeSourceId) {
          knowledge.remove(item.knowledgeSourceId).catch(err => {
            logger.warn("connector.delete.remove-knowledge-failed", { error: String(err) });
          });
        }
      }

      store.softDelete(id, deletedAt);
      logger.info("connector.delete", { id });
    },

    async getReader(id: string): Promise<ConnectorReader> {
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }

      if (entry.kind === "connector::file::text" || entry.kind === "connector::file::other") {
        const items = store.getItems(id);
        if (items.length === 0) throw new ConnectorNotFoundError(id);
        const provider = getProvider(entry.providerKind);
        return provider.getReader(entry.locator, items[0].itemKey);
      }

      throw new Error("Use getDirectoryReader for directory connectors");
    },

    getDirectoryReader(id: string): DirectoryReader {
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }

      const items = store.getItems(id);
      return {
        listItems: () => items,
        getItemReader: async (itemKey: string) => {
          const provider = getProvider(entry.providerKind);
          return provider.getReader(entry.locator, itemKey);
        },
      };
    },
  };
}