import type { Logger } from "#capabilities/observability/logger.js";
import type { Intelligence } from "#capabilities/intelligence/intelligence.js";
import type { KnowledgeResourceResolver } from "#capabilities/knowledge/types.js";
import { Knowledge } from "#capabilities/knowledge/knowledge.js";
import { IntelligenceEmbedder } from "#capabilities/knowledge/embedder.js";
import { SQLiteKnowledgeStore } from "#capabilities/database/knowledge-store.js";

const KNOWLEDGE_DB_PATH = "./data/knowledge.db";

export const createKnowledge = (
  projectId: string,
  intelligence: Intelligence,
  logger: Logger,
  resolver?: KnowledgeResourceResolver
): Knowledge => {
  const store = new SQLiteKnowledgeStore(projectId, KNOWLEDGE_DB_PATH);
  const embedder = new IntelligenceEmbedder(intelligence);
  return new Knowledge(store, embedder, logger, { resolver });
};
