export { createConnectorService } from "./application/connectorService.js";
export type { ConnectorService } from "./application/connectorService.js";

export {
  type ConnectorEntry,
  type ConnectorIngestionState,
  type ConnectorItemEntry,
  type ConnectorKind,
  type ConnectorSyncConfig,
  type SyncInterval,
  type RegisterConnectorRequest,
  type RegisterConnectorResult,
  type ItemIndexResult,
  SYNC_INTERVALS,
  PROSE_TEXT_EXTENSIONS,
} from "./domain/model.js";

export type { ConnectorProvider } from "./domain/provider.js";
export type { ConnectorItem } from "./domain/provider.js";
export type { ConnectorReader, ByteRange, DirectoryReader } from "./domain/reader.js";

export {
  ConnectorNotFoundError,
  ConnectorAlreadyExistsError,
  UnsupportedLocatorError,
  SyncInProgressError,
  ConnectorValidationError,
} from "./domain/errors.js";

export type { ConnectorStore } from "./ports/repository.js";
export { SQLiteConnectorStore } from "./persistence/sqliteConnectorRepository.js";
export { filesystemProvider } from "./providers/filesystem.js";
