// GeneralFileService — application logic for General Files capability.

import { createHash } from "node:crypto";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { AddResult } from "#platform/knowledge/types.js";
import type { Logger } from "#platform/observability/logger.js";
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
  delete(id: string): void;
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

  return {
    async upload(request: GeneralFileUploadRequest): Promise<GeneralFileUploadResult> {
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
      if (existing && !existing.deletedAt) {
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
        revision: 1,
        knowledgeSourceId: kind === "general::file::text" ? `general-file:${id}` : null,
        createdAt,
        updatedAt: createdAt,
      };

      // Persist
      store.insert(file);

      // Admit to Knowledge (text-kind only)
      const knowledgeResult = await admitToKnowledge(file);

      logger.info("general-files.upload", { id, kind, fileName, byteSize });

      return { kind: "created", file, knowledge: knowledgeResult };
    },

    async update(id: string, request: GeneralFileUpdateRequest): Promise<GeneralFileUpdateResult> {
      const existing = store.getById(id);
      if (!existing || existing.deletedAt) {
        throw new GeneralFileNotFoundError(id);
      }

      const newContentHash = hashContent(request.content);

      // If content is identical, nothing to do
      if (newContentHash === existing.contentHash) {
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
      if (existingByHash && !existingByHash.deletedAt && existingByHash.id !== id) {
        // Soft-delete old, link to new
        store.softDelete(id, createdAt);
        // Update the old record's replacedById
        store.update({ ...existing, replacedById: newId, deletedAt: createdAt, updatedAt: createdAt });

        return {
          kind: "updated",
          file: existingByHash,
          knowledge: existingByHash.knowledgeSourceId
            ? { sourceId: existingByHash.knowledgeSourceId, skipped: true, windowsAdded: 0, windowsReused: 0, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, reasoningTokens: 0 } }
            : undefined,
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
        revision: 1,
        knowledgeSourceId: kind === "general::file::text" ? `general-file:${newId}` : null,
        replacesId: id,
        createdAt,
        updatedAt: createdAt,
      };

      // Soft-delete the old file
      store.softDelete(id, createdAt);
      store.update({ ...existing, replacedById: newId, deletedAt: createdAt, updatedAt: createdAt });

      // Insert new file
      store.insert(newFile);

      // Remove old Knowledge source, admit new one
      await removeFromKnowledge(existing);
      const knowledgeResult = await admitToKnowledge(newFile);

      logger.info("general-files.update", { oldId: id, newId, kind });

      return { kind: "updated", file: newFile, knowledge: knowledgeResult };
    },

    get(id: string): GeneralFile {
      const file = store.getById(id);
      if (!file || file.deletedAt) {
        throw new GeneralFileNotFoundError(id);
      }
      return file;
    },

    list(filters?: GeneralFileFilter[]): Omit<GeneralFile, "content">[] {
      return store.list(filters);
    },

    delete(id: string): void {
      const file = store.getById(id);
      if (!file || file.deletedAt) {
        throw new GeneralFileNotFoundError(id);
      }

      const deletedAt = now();

      // Remove from Knowledge
      removeFromKnowledge(file).catch(err => {
        logger.warn("general-files.delete-knowledge-failed", { id, error: String(err) });
      });

      store.softDelete(id, deletedAt);
      store.update({ ...file, deletedAt, updatedAt: deletedAt });

      logger.info("general-files.delete", { id });
    },
  };
}