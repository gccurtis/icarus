import type { Intelligence } from "#platform/intelligence/intelligence.js";
import { Knowledge } from "#platform/knowledge/knowledge.js";
import { IntelligenceEmbedder } from "#platform/knowledge/embedder.js";
import { SQLiteKnowledgeStore } from "#platform/database/knowledge-store.js";

const KNOWLEDGE_DB_PATH = "./data/knowledge.db";

export const createKnowledge = (
  projectId: string,
  intelligence: Intelligence
): Knowledge => {
  const store = new SQLiteKnowledgeStore(projectId, KNOWLEDGE_DB_PATH);
  const embedder = new IntelligenceEmbedder(intelligence);
  return new Knowledge(store, embedder);
};
