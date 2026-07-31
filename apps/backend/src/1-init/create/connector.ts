import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import {
  createConnectorService,
  SQLiteConnectorStore,
  filesystemProvider,
  type ConnectorService,
  type ConnectorStore,
} from "#connector";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { Logger } from "#platform/observability/logger.js";

const CONNECTOR_DB_PATH = "./data/connector.db";

export interface ConnectorBindings {
  service: ConnectorService;
  store: ConnectorStore;
}

export const createConnectorInstance = (
  config: BackendConfig,
  knowledge: Knowledge,
  logger: Logger,
): ConnectorBindings => {
  const store = new SQLiteConnectorStore(config.projectId, CONNECTOR_DB_PATH);
  const providers = new Map([[filesystemProvider.kind, filesystemProvider]]);
  const service = createConnectorService(store, knowledge, providers, logger);
  return { service, store };
};