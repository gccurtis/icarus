// GeneralFileService — application logic for General Files capability.

import { createHash } from "node:crypto";
import type { Knowledge } from "#capabilities/knowledge/knowledge.js";
import type { AddResult } from "#capabilities/knowledge/types.js";
import type { Logger } from "#capabilities/observability/logger.js";
import { GeneralFileEncodingError, GeneralFileNotFoundError } from "../domain/errors.js";
import {
  kindFromExtension,
  type GeneralFile,
  type GeneralFileFilter,
  type GeneralFileUpdateRequest,
  type GeneralFileUpdateResult,
  type GeneralFileUploadRequest,
  type GeneralFileUploadResult,
} from "../domain/model.js";
import type { GeneralFileStore } from "../ports/repository.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#shared/persistence/resourceHistory.js";

/**
 * Hash content with SHA-256. Returns hex string.
 */
function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Check if a string is valid UTF-8.
 * In Node.js, strings are always UTF-16 internally, but we trust the caller
 * to provide valid bytes. For text-kind files we validate that the content
 * round-trips through Buffer without loss.
 */
function isValidUtf8(content: string): boolean {
  try {
    const buf = Buffer.from(content, "utf8");
    return buf.toString("utf8") === content;
  } catch {
    return false;
  }
}

export interface GeneralFileService {
  upload(request: GeneralFileUploadRequest): Promise<GeneralFileUploadResult>;
  update(id: string, request: GeneralFileUpdateRequest): Promise<GeneralFileUpdateResult>;
  get(id: string): GeneralFile;
  list(filters?: GeneralFileFilter[]): Omit<GeneralFile, "content">[];
  delete(id: string): Promise<void>;
  purge(id: string): Promise<void>;
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;
}

export function createGeneralFileService(
  store: GeneralFileStore,
  knowledge: Knowledge,
  logger: Logger,
): GeneralFileService {
  async function admitToKnowledge(file: GeneralFile): Promise<AddResult | undefined> {
    if (file.kind !== "general::file::text") return undefined;

    const sourceId = `general-file:${file.id}`;
    logger.debug("general-files.admit-to-knowledge", { id: file.id, sourceId });

    const result = await knowledge.add({
      sourceId,
      label: "general-file",
      revision: file.contentHash,
      text: file.content,
    });

    logger.debug("general-files.admitted", {
      id: file.id,
      windowsAdded: result.windowsAdded,
      windowsReused: result.windowsReused,
    });

    return result;
  }

  async function removeFromKnowledge(file: GeneralFile): Promise<void> {
    if (!file.knowledgeSourceId) return;
    logger.debug("general-files.remove-from-knowledge", { id: file.id, sourceId: file.knowledgeSourceId });
    await knowledge.remove(file.knowledgeSourceId);
  }

  const now = (): string => new Date().toISOString();

  async function compensateKnowledge(file: GeneralFile, operation: "add" | "remove"): Promise<void> {
    try {
      if (operation === "add") {
        await admitToKnowledge(file);
      } else {
        await removeFromKnowledge(file);
      }
    } catch (error) {
      logger.error("general-files.knowledge.compensation-failed", {
        id: file.id,
        operation,
        errorName: error instanceof Error ? error.name : "UnknownError",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function restoreKnowledgeIfStillActive(file: GeneralFile): Promise<void> {
    const current = store.getById(file.id);
    if (
      !current ||
      current.revision !== file.revision ||
      current.contentHash !== file.contentHash
    ) {
      logger.debug("general-files.knowledge.compensation-skipped", {
        id: file.id,
        reason: "source-no-longer-active",
      });
      return;
    }
    await compensateKnowledge(current, "add");
  }

  async function removeKnowledgeIfNotActive(file: GeneralFile): Promise<void> {
    const current = store.getById(file.id);
    if (current) return;
    await compensateKnowledge(file, "remove");
  }

  return {
    async upload(request: GeneralFileUploadRequest): Promise<GeneralFileUploadResult> {
      const startedAt = performance.now();
      if (!request || typeof request.fileName !== "string" || request.fileName.trim().length === 0) {
        throw new GeneralFileEncodingError("fileName must be a non-empty string");
      }
      if (typeof request.content !== "string") {
        throw new GeneralFileEncodingError("content must be a string");
      }
      const { fileName, content } = request;

      // Extract extension
      const lastDot = fileName.lastIndexOf(".");
      const extension = lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : "";

      // Determine kind
      const kind = kindFromExtension(extension);

      // Validate UTF-8 for text-kind
      if (kind === "general::file::text" && !isValidUtf8(content)) {
        throw new GeneralFileEncodingError("Content is not valid UTF-8");
      }

      // Hash content
      const contentHash = hashContent(content);
      const id = contentHash;

      // Check for existing
      const existing = store.getByHash(contentHash);
      if (existing) {
        // Upsert into Knowledge as a cheap self-heal for records left behind by
        // an earlier failed ingestion. Matching revisions are skipped.
        await admitToKnowledge(existing);
        logger.info("general-files.upload.reused", {
          id,
          kind: existing.kind,
          fileName: existing.fileName,
          byteSize: existing.byteSize,
          durationMs: Math.round(performance.now() - startedAt),
        });
        return { kind: "reused", file: existing, message: "identical content already exists" };
      }

      const createdAt = now();
      const byteSize = Buffer.byteLength(content, "utf8");

      const file: GeneralFile = {
        id,
        kind,
        fileName,
        extension,
        content,
        byteSize,
        contentHash,
        revision: store.nextRevision(id),
        knowledgeSourceId: kind === "general::file::text" ? `general-file:${id}` : null,
        createdAt,
        updatedAt: createdAt,
      };

      // Admit first, then make the row active. If persistence fails, remove
      // the newly admitted source so a retry starts from a coherent state.
      const knowledgeResult = await admitToKnowledge(file);
      try {
        store.insert(file);
      } catch (error) {
        const concurrent = store.getById(id);
        if (concurrent) {
          return { kind: "reused", file: concurrent, message: "identical content already exists" };
        }
        await compensateKnowledge(file, "remove");
        throw error;
      }

      logger.info("general-files.upload", {
        id,
        kind,
        fileName,
        byteSize,
        resumedIdentity: file.revision > 1,
        durationMs: Math.round(performance.now() - startedAt),
      });

      return { kind: "created", file, knowledge: knowledgeResult };
    },

    async update(id: string, request: GeneralFileUpdateRequest): Promise<GeneralFileUpdateResult> {
      const startedAt = performance.now();
      if (!request || typeof request.content !== "string") {
        throw new GeneralFileEncodingError("content must be a string");
      }
      const existing = store.getById(id);
      if (!existing) {
        throw new GeneralFileNotFoundError(id);
      }

      const newContentHash = hashContent(request.content);

      // If content is identical, nothing to do
      if (newContentHash === existing.contentHash) {
        await admitToKnowledge(existing);
        logger.info("general-files.update.unchanged", {
          id,
          revision: existing.revision,
          durationMs: Math.round(performance.now() - startedAt),
        });
        return { kind: "unchanged", file: existing, message: "new content identical to current" };
      }

      // Determine kind from existing filename
      const extension = existing.extension;
      const kind = kindFromExtension(extension);

      // Validate UTF-8 for text-kind
      if (kind === "general::file::text" && !isValidUtf8(request.content)) {
        throw new GeneralFileEncodingError("Updated content is not valid UTF-8");
      }

      const newId = newContentHash;
      const createdAt = now();
      const byteSize = Buffer.byteLength(request.content, "utf8");

      // Check if the new hash already exists — if so, reuse that file
      const existingByHash = store.getByHash(newContentHash);
      if (existingByHash && existingByHash.id !== id) {
        const knowledgeResult = await admitToKnowledge(existingByHash);
        await removeFromKnowledge(existing);
        try {
          store.linkReplacement(existing, existingByHash.id, createdAt);
        } catch (error) {
          await restoreKnowledgeIfStillActive(existing);
          throw error;
        }

        logger.info("general-files.update", {
          oldId: id,
          newId,
          kind,
          reused: true,
          durationMs: Math.round(performance.now() - startedAt),
        });

        return {
          kind: "updated",
          file: existingByHash,
          knowledge: knowledgeResult,
        };
      }

      const newFile: GeneralFile = {
        id: newId,
        kind,
        fileName: existing.fileName,
        extension,
        content: request.content,
        byteSize,
        contentHash: newContentHash,
        revision: store.nextRevision(newId),
        knowledgeSourceId: kind === "general::file::text" ? `general-file:${newId}` : null,
        replacesId: id,
        createdAt,
        updatedAt: createdAt,
      };

      const knowledgeResult = await admitToKnowledge(newFile);
      try {
        await removeFromKnowledge(existing);
      } catch (error) {
        await compensateKnowledge(newFile, "remove");
        throw error;
      }

      try {
        store.replace(existing, newFile, createdAt);
      } catch (error) {
        await removeKnowledgeIfNotActive(newFile);
        await restoreKnowledgeIfStillActive(existing);
        throw error;
      }

      logger.info("general-files.update", {
        oldId: id,
        newId,
        kind,
        reused: false,
        durationMs: Math.round(performance.now() - startedAt),
      });

      return { kind: "updated", file: newFile, knowledge: knowledgeResult };
    },

    get(id: string): GeneralFile {
      const startedAt = performance.now();
      const file = store.getById(id);
      if (!file) {
        throw new GeneralFileNotFoundError(id);
      }
      logger.debug("general-files.get", {
        id,
        byteSize: file.byteSize,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return file;
    },

    list(filters?: GeneralFileFilter[]): Omit<GeneralFile, "content">[] {
      const startedAt = performance.now();
      const files = store.list(filters);
      logger.debug("general-files.list", {
        count: files.length,
        filterCount: filters?.length ?? 0,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return files;
    },

    async delete(id: string): Promise<void> {
      const startedAt = performance.now();
      const file = store.getById(id);
      if (!file) {
        throw new GeneralFileNotFoundError(id);
      }

      const deletedAt = now();

      await removeFromKnowledge(file);
      try {
        const revision = store.delete(id, deletedAt);
        if (revision === undefined) throw new GeneralFileNotFoundError(id);
      } catch (error) {
        await restoreKnowledgeIfStillActive(file);
        throw error;
      }

      logger.info("general-files.delete", {
        id,
        durationMs: Math.round(performance.now() - startedAt),
      });
    },

    async purge(id: string): Promise<void> {
      const outcome = store.purge(id);
      if (outcome === "current") throw new ResourceNotDeletedError("general-file", id);
      if (outcome === "missing") throw new ResourceHistoryNotFoundError("general-file", id);
      logger.info("general-files.purge", { id });
    },

    pruneHistory(cutoff: string): number {
      return store.pruneHistory(cutoff);
    },

    purgeExpired(cutoff: string): number {
      return store.purgeExpired(cutoff);
    },
  };
}
