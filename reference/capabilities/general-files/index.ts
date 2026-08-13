export { createGeneralFileService } from "./application/generalFileService.js";
export type { GeneralFileService } from "./application/generalFileService.js";

export {
  kindFromExtension,
  PROSE_TEXT_EXTENSIONS,
  type GeneralFile,
  type GeneralFileFilter,
  type GeneralFileKind,
  type GeneralFilesListRequest,
  type GeneralFileUpdateRequest,
  type GeneralFileUploadRequest,
  type GeneralFileUpdateResult,
  type GeneralFileUploadResult,
} from "./domain/model.js";

export { GeneralFileEncodingError, GeneralFileNotFoundError } from "./domain/errors.js";

export type { GeneralFileStore } from "./ports/repository.js";

export { SQLiteGeneralFileStore } from "./persistence/sqliteGeneralFileRepository.js";