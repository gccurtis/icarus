import type { PGlite } from "@electric-sql/pglite";
import type { Kysely } from "kysely";
import type { Logger } from "#observability";
import type { BackendDatabase } from "#persistence/types/database.js";
import { closeDatabase } from "#persistence/runtime-api/close/close.js";

/**
 * The one database owner for one backend runtime. Capabilities receive its
 * Kysely client; only the runtime lifecycle closes it.
 */
export interface DatabaseRuntime {
  readonly database: Kysely<BackendDatabase>;
  readonly pglite: PGlite;
  close(): Promise<void>;
}

/** The embedded PostgreSQL implementation: PGlite behind a Kysely client. */
export class PGliteDatabaseRuntime implements DatabaseRuntime {
  constructor(
    readonly database: Kysely<BackendDatabase>,
    readonly pglite: PGlite,
    private readonly logger: Logger
  ) {}

  async close(): Promise<void> {
    this.logger.debug("persistence.close.started", {});
    await closeDatabase(this.database, this.pglite);
    this.logger.debug("persistence.close.completed", {});
  }
}
