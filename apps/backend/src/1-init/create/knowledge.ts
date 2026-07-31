import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import type { Intelligence } from "#platform/intelligence/intelligence.js";
import { Knowledge } from "#platform/knowledge/knowledge.js";
import { IntelligenceEmbedder } from "#platform/knowledge/embedder.js";
import { SQLiteKnowledgeStore } from "#platform/database/knowledge-store.js";

export const createKnowledge = (
  config: BackendConfig,
  intelligence: Intelligence
): Knowledge => {
  const store = new SQLiteKnowledgeStore(
    config.knowledge.projectId,
    config.knowledge.databasePath
  );
  const embedder = new IntelligenceEmbedder(intelligence);
  return new Knowledge(store, embedder);
};
