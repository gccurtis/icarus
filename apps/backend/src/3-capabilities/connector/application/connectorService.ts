// ConnectorService — application logic for Connector capability.

import { createHash } from "node:crypto";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { AddResult } from "#platform/knowledge/types.js";
import type { Logger } from "#platform/observability/logger.js";
import { ConnectorNotFoundError, ConnectorValidationError, SyncInProgressError } from "../domain/errors.js";
import {
  SYNC_INTERVALS,
  type ConnectorEntry,
  type ConnectorItemEntry,
  type ConnectorKind,
  type ConnectorSyncConfig,
  type ItemIndexResult,
  type RegisterConnectorRequest,
  type RegisterConnectorResult,
} from "../domain/model.js";
import type { ConnectorProvider } from "../domain/provider.js";
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

export interface ConnectorService {
  register(request: RegisterConnectorRequest): Promise<RegisterConnectorResult>;
  sync(connectorId: string, lockAlreadyAcquired?: boolean): Promise<void>;
  get(id: string): ConnectorEntry;
  list(): ConnectorEntry[];
  delete(id: string): Promise<void>;
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
    if (!provider) throw new ConnectorValidationError(`Unknown provider: ${kind}`);
    return provider;
  }

  const now = (): string => new Date().toISOString();

  function publicEntry(entry: ConnectorEntry): ConnectorEntry {
    if ((entry.ingestionState ?? "active") === "active") return entry;
    // Pending/failed source unions are recovery metadata, not a safe
    // Knowledge scope. Keep the state visible while withholding those IDs.
    return { ...entry, knowledgeSourceIds: [] };
  }

  return {
    async register(request: RegisterConnectorRequest): Promise<RegisterConnectorResult> {
      const startedAt = performance.now();
      if (!request || typeof request.providerKind !== "string" || request.providerKind.length === 0) {
        throw new ConnectorValidationError("providerKind must be a non-empty string");
      }
      if (typeof request.locator !== "string" || request.locator.trim().length === 0) {
        throw new ConnectorValidationError("locator must be a non-empty string");
      }
      if (
        request.syncInterval !== undefined &&
        !Object.prototype.hasOwnProperty.call(SYNC_INTERVALS, request.syncInterval)
      ) {
        throw new ConnectorValidationError(`Unsupported sync interval: ${String(request.syncInterval)}`);
      }

      const { providerKind, locator, syncInterval } = request;
      const provider = getProvider(providerKind);

      // Check for existing
      const existing = store.getByProviderAndLocator(providerKind, locator);
      if (existing) {
        logger.info("connector.register.already-exists", {
          id: existing.id,
          providerKind,
          itemCount: store.getItems(existing.id).length,
          durationMs: Math.round(performance.now() - startedAt),
        });
        return {
          status: "already_exists",
          entry: publicEntry(existing),
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
      const kind = determineKind(items);

      const entryId = connectorId(providerKind, locator);
      const deleted = store.getById(entryId);
      const createdAt = now();
      const label = locator;

      // Build sync config if applicable
      let syncConfig: ConnectorSyncConfig | null = null;
      if (provider.syncType === "scheduled" && syncInterval) {
        syncConfig = { syncType: "scheduled", interval: syncInterval };
      }

      const indexResults: ItemIndexResult[] = [];
      const entryItems: ConnectorItemEntry[] = [];
      const knowledgeSourceIds: string[] = [];
      const admittedSourceIds: string[] = [];

      try {
        for (const item of items) {
          const ext = item.extension ?? "";
          const itemStatus = item.status;
          let sourceId: string | null = null;
          let knowledgeResult: AddResult | undefined;

          if (itemStatus === "prose") {
            sourceId = connectorKnowledgeSourceId(entryId, item.key);
            const reader = await provider.getReader(locator, item.key);

            logger.debug("connector.register.admitting", { entryId, itemKey: item.key, sourceId });
            knowledgeResult = await knowledge.add({
              sourceId,
              label: "connector-item",
              revision: item.revisionToken,
              text: await reader.readAll(),
            });
            admittedSourceIds.push(sourceId);
            knowledgeSourceIds.push(sourceId);
          }

          entryItems.push({
            itemKey: item.key,
            name: item.name,
            extension: ext,
            byteSize: item.byteSize,
            revisionToken: item.revisionToken,
            lastModifiedAt: createdAt,
            status: itemStatus,
            knowledgeSourceId: sourceId,
          });

          indexResults.push({
            itemKey: item.key,
            name: item.name,
            status: itemStatus === "prose" ? "indexed" : "stored",
            ...(knowledgeResult ? { knowledge: knowledgeResult } : {}),
          });
        }

        const entry: ConnectorEntry = {
          id: entryId,
          kind,
          providerKind,
          locator,
          label,
          revision: deleted ? deleted.revision + 1 : 1,
          syncConfig,
          syncing: false,
          ingestionState: "active",
          knowledgeSourceIds,
          createdAt,
          updatedAt: createdAt,
        };

        if (deleted) {
          store.restore(entry, entryItems);
        } else {
          store.insert(entry, entryItems);
        }

        logger.info("connector.register", {
          id: entryId,
          kind,
          providerKind,
          itemCount: items.length,
          proseItemCount: knowledgeSourceIds.length,
          resurrected: Boolean(deleted),
          durationMs: Math.round(performance.now() - startedAt),
        });

        return { status: "registered", entry, indexResults };
      } catch (error) {
        const concurrent = store.getByProviderAndLocator(providerKind, locator);
        if (concurrent) {
          logger.info("connector.register.concurrent-reuse", {
            id: concurrent.id,
            providerKind,
            durationMs: Math.round(performance.now() - startedAt),
          });
          return {
            status: "already_exists",
            entry: publicEntry(concurrent),
            indexResults: store.getItems(concurrent.id).map(item => ({
              itemKey: item.itemKey,
              name: item.name,
              status: item.status === "prose" ? "indexed" : "stored",
            })),
          };
        }
        for (const sourceId of admittedSourceIds) {
          try {
            await knowledge.remove(sourceId);
          } catch (cleanupError) {
            logger.error("connector.register.compensation-failed", {
              entryId,
              sourceId,
              errorName: cleanupError instanceof Error ? cleanupError.name : "UnknownError",
              error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            });
          }
        }
        throw error;
      }
    },

    async sync(connectorId: string, lockAlreadyAcquired = false): Promise<void> {
      const startedAt = performance.now();
      const entry = store.getById(connectorId);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(connectorId);
      }

      if (lockAlreadyAcquired) {
        if (!entry.syncing) {
          throw new SyncInProgressError(connectorId);
        }
      } else {
        const acquired = store.setSyncing(connectorId);
        if (!acquired) {
          throw new SyncInProgressError(connectorId);
        }
      }

      logger.info("connector.sync.starting", {
        id: connectorId,
        kind: entry.kind,
        providerKind: entry.providerKind,
      });

      let reconciliationMarked = false;
      let trackedSourceIds = [...new Set(entry.knowledgeSourceIds)];
      try {
        const provider = getProvider(entry.providerKind);

        // Re-list all current items from the provider
        const currentItems = await provider.listItems(entry.locator);
        const existingItems = store.getItems(connectorId);
        const existingMap = new Map(existingItems.map(i => [i.itemKey, i]));
        const currentKeys = new Set(currentItems.map(i => i.key));
        const currentProseSourceIds = currentItems
          .filter(item => item.status === "prose")
          .map(item => connectorKnowledgeSourceId(connectorId, item.key));

        // Persist the recovery boundary before Knowledge changes. Keep the
        // last active item snapshot, but track every old/current source that a
        // retry may need to reconcile. A crash or failure can therefore never
        // present the old snapshot as known-good.
        trackedSourceIds = [...new Set([
          ...entry.knowledgeSourceIds,
          ...currentProseSourceIds,
        ])];
        store.markIngestionState(connectorId, "pending", trackedSourceIds, now());
        reconciliationMarked = true;

        const newEntries: ConnectorItemEntry[] = [];
        const sourceIdsToRemove = new Set<string>();
        const forceReconciliation = (entry.ingestionState ?? "active") !== "active";
        let changedCount = 0;
        let addedCount = 0;
        let removedCount = 0;

        // Process current items: add new, update changed
        for (const item of currentItems) {
          const ext = item.extension ?? "";
          const itemStatus = item.status;
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
          } else {
            const metadataChanged =
              existing.revisionToken !== item.revisionToken ||
              existing.name !== item.name ||
              existing.extension !== ext ||
              existing.byteSize !== item.byteSize ||
              existing.status !== itemStatus;
            const mustReadProse = itemStatus === "prose" && (metadataChanged || forceReconciliation);

            if (metadataChanged) changedCount++;
            let sourceId = itemStatus === "prose"
              ? existing.knowledgeSourceId ?? connectorKnowledgeSourceId(connectorId, item.key)
              : null;

            if (mustReadProse && sourceId) {
              const reader = await provider.getReader(entry.locator, item.key);
              logger.debug("connector.sync.updating", { connectorId, itemKey: item.key, sourceId });
              await knowledge.add({
                sourceId,
                label: "connector-item",
                revision: item.revisionToken,
                text: await reader.readAll(),
              });
            } else if (itemStatus === "other" && existing.knowledgeSourceId) {
              logger.debug("connector.sync.removing-transitioned-source", {
                connectorId,
                itemKey: item.key,
                sourceId: existing.knowledgeSourceId,
              });
              sourceIdsToRemove.add(existing.knowledgeSourceId);
            }

            newEntries.push({
              itemKey: item.key,
              name: item.name,
              extension: ext,
              byteSize: item.byteSize,
              revisionToken: item.revisionToken,
              lastModifiedAt: metadataChanged ? now() : existing.lastModifiedAt,
              status: itemStatus,
              knowledgeSourceId: sourceId,
            });
          }
        }

        // Remove items no longer on disk
        for (const existing of existingItems) {
          if (!currentKeys.has(existing.itemKey)) {
            removedCount++;
            if (existing.knowledgeSourceId) {
              logger.debug("connector.sync.removing-missing-source", {
                connectorId,
                itemKey: existing.itemKey,
                sourceId: existing.knowledgeSourceId,
              });
              sourceIdsToRemove.add(existing.knowledgeSourceId);
            }
          }
        }

        const cleanedKnowledgeSourceIds = newEntries
          .map(item => item.knowledgeSourceId)
          .filter((sourceId): sourceId is string => sourceId !== null);
        const currentSourceIds = new Set(cleanedKnowledgeSourceIds);

        // Failed/pending attempts may have touched sources that were never
        // part of the last active item snapshot. The persisted union makes
        // those orphans discoverable and safe to remove on retry.
        for (const sourceId of trackedSourceIds) {
          if (!currentSourceIds.has(sourceId)) sourceIdsToRemove.add(sourceId);
        }
        for (const sourceId of sourceIdsToRemove) {
          await knowledge.remove(sourceId);
        }

        // Recompute kind based on new items
        const newKind = determineKind(newEntries.map(e => ({ status: e.status })));
        const completedAt = now();

        const updatedEntry: ConnectorEntry = {
          ...entry,
          kind: newKind,
          revision: entry.revision + 1,
          syncing: true,
          ingestionState: "active",
          knowledgeSourceIds: cleanedKnowledgeSourceIds,
          syncConfig: entry.syncConfig
            ? { ...entry.syncConfig, lastSyncedAt: completedAt }
            : null,
          updatedAt: completedAt,
        };
        store.update(updatedEntry, newEntries);

        logger.info("connector.sync.complete", {
          id: connectorId,
          kind: newKind,
          items: newEntries.length,
          added: addedCount,
          changed: changedCount,
          removed: removedCount,
          reconciled: forceReconciliation,
          durationMs: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        if (reconciliationMarked) {
          try {
            store.markIngestionState(connectorId, "failed", trackedSourceIds, now());
          } catch (stateError) {
            // The earlier pending marker remains authoritative even if the
            // more specific failed transition cannot be persisted.
            logger.error("connector.sync.state-failed", {
              connectorId,
              errorName: stateError instanceof Error ? stateError.name : "UnknownError",
              error: stateError instanceof Error ? stateError.message : String(stateError),
            });
          }
        }
        logger.error("connector.sync.error", {
          connectorId,
          errorName: error instanceof Error ? error.name : "UnknownError",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(performance.now() - startedAt),
        });
        throw error;
      } finally {
        store.clearSyncing(connectorId);
      }
    },

    get(id: string): ConnectorEntry {
      const startedAt = performance.now();
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }
      logger.debug("connector.get", {
        id,
        kind: entry.kind,
        revision: entry.revision,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return publicEntry(entry);
    },

    list(): ConnectorEntry[] {
      const startedAt = performance.now();
      const entries = store.listAll().map(publicEntry);
      logger.debug("connector.list", {
        count: entries.length,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return entries;
    },

    async delete(id: string): Promise<void> {
      const startedAt = performance.now();
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }

      // Delete shares the same persisted claim as sync. Acquire it before any
      // asynchronous Knowledge cleanup so a sync cannot begin mid-delete.
      const acquired = store.setSyncing(id);
      if (!acquired) {
        const current = store.getById(id);
        if (!current || current.deletedAt) {
          throw new ConnectorNotFoundError(id);
        }
        throw new SyncInProgressError(id);
      }

      const deletedAt = now();

      const items = store.getItems(id);
      const trackedSourceIds = [...new Set([
        ...entry.knowledgeSourceIds,
        ...items
          .map(item => item.knowledgeSourceId)
          .filter((sourceId): sourceId is string => sourceId !== null),
      ])];
      let reconciliationMarked = false;
      try {
        store.markIngestionState(id, "pending", trackedSourceIds, now());
        reconciliationMarked = true;
        for (const sourceId of trackedSourceIds) {
          logger.debug("connector.delete.removing-source", {
            connectorId: id,
            sourceId,
          });
          await knowledge.remove(sourceId);
        }
        store.softDelete(id, deletedAt);
      } catch (error) {
        if (reconciliationMarked) {
          try {
            store.markIngestionState(id, "failed", trackedSourceIds, now());
          } catch (stateError) {
            logger.error("connector.delete.state-failed", {
              connectorId: id,
              errorName: stateError instanceof Error ? stateError.name : "UnknownError",
              error: stateError instanceof Error ? stateError.message : String(stateError),
            });
          }
        }
        logger.error("connector.delete.error", {
          connectorId: id,
          errorName: error instanceof Error ? error.name : "UnknownError",
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(performance.now() - startedAt),
        });
        throw error;
      } finally {
        // The claim remains held through softDelete; releasing it afterward
        // changes only the syncing flag and cannot reactivate the row.
        store.clearSyncing(id);
      }

      logger.info("connector.delete", {
        id,
        itemCount: items.length,
        knowledgeSourceCount: entry.knowledgeSourceIds.length,
        durationMs: Math.round(performance.now() - startedAt),
      });
    },

    async getReader(id: string): Promise<ConnectorReader> {
      const startedAt = performance.now();
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }

      if (entry.kind === "connector::file::text" || entry.kind === "connector::file::other") {
        const items = store.getItems(id);
        if (items.length === 0) throw new ConnectorNotFoundError(id);
        const provider = getProvider(entry.providerKind);
        const reader = await provider.getReader(entry.locator, items[0].itemKey);
        logger.debug("connector.reader.created", {
          id,
          itemKey: items[0].itemKey,
          byteSize: reader.byteSize,
          durationMs: Math.round(performance.now() - startedAt),
        });
        return reader;
      }

      throw new Error("Use getDirectoryReader for directory connectors");
    },

    getDirectoryReader(id: string): DirectoryReader {
      const startedAt = performance.now();
      const entry = store.getById(id);
      if (!entry || entry.deletedAt) {
        throw new ConnectorNotFoundError(id);
      }

      const items = store.getItems(id);
      logger.debug("connector.directory-reader.created", {
        id,
        itemCount: items.length,
        durationMs: Math.round(performance.now() - startedAt),
      });
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
