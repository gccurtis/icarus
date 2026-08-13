import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError,
  initializeResourceHistorySchema,
  insertHistoryDeletion,
  insertHistorySnapshot,
  listExpiredDeletedResources,
  pruneHistoryBefore,
  purgeResourceHistory
} from "#shared/persistence/resourceHistory.js";
import type {
  Finding,
  FindingFilter,
  Hypothesis,
  HypothesisFilter,
  Question,
  QuestionFilter
} from "../domain/model.js";
import type { InvestigationStore } from "../ports/investigationStore.js";

type SQLiteRow = Record<string, unknown>;

interface InvestigationTableNames {
  questions: string;
  hypotheses: string;
  findings: string;
  history: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

const createTableNames = (projectId: string): InvestigationTableNames => {
  const root = `inv_${projectPrefix(projectId)}`;
  return {
    questions: `${root}_questions`,
    hypotheses: `${root}_hypotheses`,
    findings: `${root}_findings`,
    history: `${root}_history`
  };
};

const encodeJson = (value: unknown): string => JSON.stringify(value);

const decodeJson = <T>(value: unknown): T => JSON.parse(value as string) as T;

const optionalString = <K extends string>(
  key: K,
  value: unknown
): { [P in K]: string } | Record<never, never> =>
  value === null || value === undefined
    ? {}
    : ({ [key]: value as string } as { [P in K]: string });

const rowToQuestion = (row: SQLiteRow): Question => ({
  id: row.id as string,
  text: row.text as string,
  ...optionalString("context", row.context),
  ...optionalString("currentAnswer", row.current_answer),
  assumptions: decodeJson<Question["assumptions"]>(row.assumptions_json),
  status: row.status as Question["status"],
  tags: decodeJson<Question["tags"]>(row.tags_json),
  revision: Number(row.revision),
  createdBy: row.created_by as string,
  updatedBy: row.updated_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

const rowToHypothesis = (row: SQLiteRow): Hypothesis => ({
  id: row.id as string,
  questionIds: decodeJson<Hypothesis["questionIds"]>(row.question_ids_json),
  statement: row.statement as string,
  ...optionalString("rationale", row.rationale),
  assumptions: decodeJson<Hypothesis["assumptions"]>(row.assumptions_json),
  status: row.status as Hypothesis["status"],
  ...(row.confidence_level === null || row.confidence_level === undefined
    ? {}
    : { confidenceLevel: row.confidence_level as Hypothesis["confidenceLevel"] }),
  revision: Number(row.revision),
  createdBy: row.created_by as string,
  updatedBy: row.updated_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

const rowToFinding = (row: SQLiteRow): Finding => ({
  id: row.id as string,
  claim: row.claim as string,
  references: decodeJson<Finding["references"]>(row.references_json),
  ...optionalString("commentary", row.commentary),
  status: row.status as Finding["status"],
  tags: decodeJson<Finding["tags"]>(row.tags_json),
  questionLinks: decodeJson<Finding["questionLinks"]>(row.question_links_json),
  hypothesisLinks: decodeJson<Finding["hypothesisLinks"]>(
    row.hypothesis_links_json
  ),
  ...optionalString("knowledgeSourceId", row.knowledge_source_id),
  revision: Number(row.revision),
  createdBy: row.created_by as string,
  updatedBy: row.updated_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

const initializeSchema = (
  db: DatabaseConnection,
  tables: InvestigationTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tables.questions} (
        id                   TEXT PRIMARY KEY,
        text                 TEXT NOT NULL,
        context              TEXT,
        current_answer       TEXT,
        assumptions_json     TEXT NOT NULL DEFAULT '[]',
        status               TEXT NOT NULL
                               CHECK (status IN ('open', 'proposed', 'answered')),
        tags_json            TEXT NOT NULL DEFAULT '[]',
        revision             INTEGER NOT NULL CHECK (revision >= 1),
        created_by           TEXT NOT NULL,
        updated_by           TEXT NOT NULL,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS ${tables.questions}_recent
        ON ${tables.questions}(status, updated_at DESC);

      CREATE TABLE IF NOT EXISTS ${tables.hypotheses} (
        id                   TEXT PRIMARY KEY,
        question_ids_json    TEXT NOT NULL DEFAULT '[]',
        statement            TEXT NOT NULL,
        rationale            TEXT,
        assumptions_json     TEXT NOT NULL DEFAULT '[]',
        status               TEXT NOT NULL CHECK (
                               status IN (
                                 'proposed', 'accepted', 'refuted', 'inconclusive'
                               )
                             ),
        confidence_level     TEXT CHECK (
                               confidence_level IS NULL OR confidence_level IN (
                                 'strongly_refuted',
                                 'weakly_refuted',
                                 'uncertain',
                                 'weakly_supported',
                                 'strongly_supported'
                               )
                             ),
        revision             INTEGER NOT NULL CHECK (revision >= 1),
        created_by           TEXT NOT NULL,
        updated_by           TEXT NOT NULL,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS ${tables.hypotheses}_recent
        ON ${tables.hypotheses}(status, updated_at DESC);

      CREATE TABLE IF NOT EXISTS ${tables.findings} (
        id                    TEXT PRIMARY KEY,
        claim                 TEXT NOT NULL,
        references_json       TEXT NOT NULL,
        commentary            TEXT,
        status                TEXT NOT NULL
                                CHECK (status IN ('proposed','accepted','rejected')),
        tags_json              TEXT NOT NULL DEFAULT '[]',
        question_links_json    TEXT NOT NULL DEFAULT '[]',
        hypothesis_links_json  TEXT NOT NULL DEFAULT '[]',
        knowledge_source_id    TEXT,
        revision               INTEGER NOT NULL CHECK (revision >= 1),
        created_by             TEXT NOT NULL,
        updated_by             TEXT NOT NULL,
        created_at             TEXT NOT NULL,
        updated_at             TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS ${tables.findings}_recent
        ON ${tables.findings}(status, updated_at DESC);

      CREATE INDEX IF NOT EXISTS ${tables.findings}_knowledge_source
        ON ${tables.findings}(knowledge_source_id)
        WHERE status = 'accepted';
    `);
    initializeResourceHistorySchema(db, tables.history);
  })();
};

/** One-connection SQLite persistence for all project-local Investigation data. */
export class SQLiteInvestigationStore implements InvestigationStore {
  private readonly db: DatabaseConnection;
  private readonly tables: InvestigationTableNames;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.tables = createTableNames(projectId);
    initializeSchema(this.db, this.tables);
  }

  close(): void {
    this.db.close();
  }

  insertQuestion(question: Question): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.questions}
          (id, text, context, current_answer, assumptions_json, status,
           tags_json, revision, created_by, updated_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        question.id,
        question.text,
        question.context ?? null,
        question.currentAnswer ?? null,
        encodeJson(question.assumptions),
        question.status,
        encodeJson(question.tags),
        question.revision,
        question.createdBy,
        question.updatedBy,
        question.createdAt,
        question.updatedAt
      );
  }

  getQuestion(id: string): Question | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.questions} WHERE id = ?`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToQuestion(row) : undefined;
  }

  listQuestions(filter: QuestionFilter = {}): Question[] {
    const where = ["1 = 1"];
    const parameters: unknown[] = [];

    if (filter.status !== undefined) {
      where.push("status = ?");
      parameters.push(filter.status);
    }
    if (filter.tag !== undefined) {
      where.push(
        "EXISTS (SELECT 1 FROM json_each(tags_json) AS tag WHERE tag.value = ?)"
      );
      parameters.push(filter.tag);
    }

    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.questions}
        WHERE ${where.join(" AND ")}
        ORDER BY updated_at DESC, id ASC
      `)
      .all(...parameters) as SQLiteRow[];
    return rows.map(rowToQuestion);
  }

  updateQuestion(question: Question): void {
    this.db.transaction(() => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.questions} WHERE id = ?`
      ).get(question.id) as SQLiteRow | undefined;
      if (!row) return;
      const previous = rowToQuestion(row);
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "question",
        resourceId: question.id,
        revision: previous.revision,
        snapshot: previous,
        recordedAt: question.updatedAt
      });
      this.db.prepare(`
        UPDATE ${this.tables.questions}
        SET text = ?, context = ?, current_answer = ?, assumptions_json = ?,
            status = ?, tags_json = ?, revision = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        question.text,
        question.context ?? null,
        question.currentAnswer ?? null,
        encodeJson(question.assumptions),
        question.status,
        encodeJson(question.tags),
        question.revision,
        question.updatedBy,
        question.updatedAt,
        question.id
      );
    })();
  }

  deleteQuestion(question: Question, deletedAt: string): void {
    this.deleteCurrent("question", this.tables.questions, question, deletedAt);
  }

  insertHypothesis(hypothesis: Hypothesis): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.hypotheses}
          (id, question_ids_json, statement, rationale, assumptions_json,
           status, confidence_level, revision, created_by, updated_by, created_at,
           updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        hypothesis.id,
        encodeJson(hypothesis.questionIds),
        hypothesis.statement,
        hypothesis.rationale ?? null,
        encodeJson(hypothesis.assumptions),
        hypothesis.status,
        hypothesis.confidenceLevel ?? null,
        hypothesis.revision,
        hypothesis.createdBy,
        hypothesis.updatedBy,
        hypothesis.createdAt,
        hypothesis.updatedAt
      );
  }

  getHypothesis(id: string): Hypothesis | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.hypotheses} WHERE id = ?`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToHypothesis(row) : undefined;
  }

  listHypotheses(filter: HypothesisFilter = {}): Hypothesis[] {
    const where = ["1 = 1"];
    const parameters: unknown[] = [];

    if (filter.status !== undefined) {
      where.push("hypothesis.status = ?");
      parameters.push(filter.status);
    }
    if (filter.questionId !== undefined) {
      where.push(`
        EXISTS (
          SELECT 1 FROM ${this.tables.questions} AS question
          WHERE question.id = ?
        )
      `);
      parameters.push(filter.questionId);
      where.push(`
        EXISTS (
          SELECT 1 FROM json_each(hypothesis.question_ids_json) AS linked_question
          WHERE linked_question.value = ?
        )
      `);
      parameters.push(filter.questionId);
    }

    const rows = this.db
      .prepare(`
        SELECT hypothesis.* FROM ${this.tables.hypotheses} AS hypothesis
        WHERE ${where.join(" AND ")}
        ORDER BY hypothesis.updated_at DESC, hypothesis.id ASC
      `)
      .all(...parameters) as SQLiteRow[];
    return rows.map(rowToHypothesis);
  }

  updateHypothesis(hypothesis: Hypothesis): void {
    this.db.transaction(() => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.hypotheses} WHERE id = ?`
      ).get(hypothesis.id) as SQLiteRow | undefined;
      if (!row) return;
      const previous = rowToHypothesis(row);
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "hypothesis",
        resourceId: hypothesis.id,
        revision: previous.revision,
        snapshot: previous,
        recordedAt: hypothesis.updatedAt
      });
      this.db.prepare(`
        UPDATE ${this.tables.hypotheses}
        SET question_ids_json = ?, statement = ?, rationale = ?,
            assumptions_json = ?, status = ?, confidence_level = ?,
            revision = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        encodeJson(hypothesis.questionIds),
        hypothesis.statement,
        hypothesis.rationale ?? null,
        encodeJson(hypothesis.assumptions),
        hypothesis.status,
        hypothesis.confidenceLevel ?? null,
        hypothesis.revision,
        hypothesis.updatedBy,
        hypothesis.updatedAt,
        hypothesis.id
      );
    })();
  }

  deleteHypothesis(hypothesis: Hypothesis, deletedAt: string): void {
    this.deleteCurrent("hypothesis", this.tables.hypotheses, hypothesis, deletedAt);
  }

  insertFinding(finding: Finding): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.findings}
          (id, claim, references_json, commentary, status, tags_json,
           question_links_json, hypothesis_links_json, knowledge_source_id,
           revision, created_by, updated_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        finding.id,
        finding.claim,
        encodeJson(finding.references),
        finding.commentary ?? null,
        finding.status,
        encodeJson(finding.tags),
        encodeJson(finding.questionLinks),
        encodeJson(finding.hypothesisLinks),
        finding.knowledgeSourceId ?? null,
        finding.revision,
        finding.createdBy,
        finding.updatedBy,
        finding.createdAt,
        finding.updatedAt
      );
  }

  getFinding(id: string): Finding | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.findings} WHERE id = ?`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToFinding(row) : undefined;
  }

  listFindings(filter: FindingFilter = {}): Finding[] {
    const where = ["1 = 1"];
    const parameters: unknown[] = [];

    if (filter.status !== undefined) {
      where.push("finding.status = ?");
      parameters.push(filter.status);
    }
    if (filter.questionId !== undefined) {
      where.push(`
        EXISTS (
          SELECT 1 FROM ${this.tables.questions} AS question
          WHERE question.id = ?
        )
      `);
      parameters.push(filter.questionId);
      where.push(`
        EXISTS (
          SELECT 1 FROM json_each(finding.question_links_json) AS link
          WHERE json_extract(link.value, '$.questionId') = ?
        )
      `);
      parameters.push(filter.questionId);
    }
    if (filter.hypothesisId !== undefined) {
      where.push(`
        EXISTS (
          SELECT 1 FROM ${this.tables.hypotheses} AS hypothesis
          WHERE hypothesis.id = ?
        )
      `);
      parameters.push(filter.hypothesisId);
      where.push(`
        EXISTS (
          SELECT 1 FROM json_each(finding.hypothesis_links_json) AS link
          WHERE json_extract(link.value, '$.hypothesisId') = ?
        )
      `);
      parameters.push(filter.hypothesisId);
    }

    const rows = this.db
      .prepare(`
        SELECT finding.* FROM ${this.tables.findings} AS finding
        WHERE ${where.join(" AND ")}
        ORDER BY finding.updated_at DESC, finding.id ASC
      `)
      .all(...parameters) as SQLiteRow[];
    return rows.map(rowToFinding);
  }

  updateFinding(finding: Finding): void {
    this.db.transaction(() => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.findings} WHERE id = ?`
      ).get(finding.id) as SQLiteRow | undefined;
      if (!row) return;
      const previous = rowToFinding(row);
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "finding",
        resourceId: finding.id,
        revision: previous.revision,
        snapshot: previous,
        recordedAt: finding.updatedAt
      });
      this.db.prepare(`
        UPDATE ${this.tables.findings}
        SET claim = ?, references_json = ?, commentary = ?, status = ?,
            tags_json = ?, question_links_json = ?, hypothesis_links_json = ?,
            knowledge_source_id = ?, revision = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        finding.claim,
        encodeJson(finding.references),
        finding.commentary ?? null,
        finding.status,
        encodeJson(finding.tags),
        encodeJson(finding.questionLinks),
        encodeJson(finding.hypothesisLinks),
        finding.knowledgeSourceId ?? null,
        finding.revision,
        finding.updatedBy,
        finding.updatedAt,
        finding.id
      );
    })();
  }

  deleteFinding(finding: Finding, deletedAt: string): void {
    this.deleteCurrent("finding", this.tables.findings, finding, deletedAt);
  }

  acceptFindingIfClaimMatches(
    id: string,
    expectedClaim: string,
    knowledgeSourceId: string,
    updatedBy: string,
    updatedAt: string
  ): boolean {
    return this.db.transaction(() => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.findings} WHERE id = ? AND claim = ?`
      ).get(id, expectedClaim) as SQLiteRow | undefined;
      if (!row) return false;
      const previous = rowToFinding(row);
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "finding",
        resourceId: id,
        revision: previous.revision,
        snapshot: previous,
        recordedAt: updatedAt
      });
      const result = this.db.prepare(`
        UPDATE ${this.tables.findings}
        SET status = 'accepted', knowledge_source_id = ?, revision = revision + 1,
            updated_by = ?, updated_at = ?
        WHERE id = ? AND claim = ?
      `).run(knowledgeSourceId, updatedBy, updatedAt, id, expectedClaim);
      return result.changes === 1;
    })();
  }

  purge(resourceKind: "question" | "hypothesis" | "finding", id: string): void {
    const table = this.tableFor(resourceKind);
    if (this.db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)) {
      throw new ResourceNotDeletedError(resourceKind, id);
    }
    if (!purgeResourceHistory(this.db, this.tables.history, resourceKind, id)) {
      throw new ResourceHistoryNotFoundError(resourceKind, id);
    }
  }

  pruneHistory(cutoff: string): number {
    return pruneHistoryBefore(
      this.db,
      this.tables.history,
      cutoff,
      (kind, id) => Boolean(this.db.prepare(
        `SELECT 1 FROM ${this.tableFor(kind as "question" | "hypothesis" | "finding")} WHERE id = ?`
      ).get(id))
    );
  }

  expiredDeleted(cutoff: string): Array<{
    resourceKind: "question" | "hypothesis" | "finding";
    resourceId: string;
  }> {
    return listExpiredDeletedResources(this.db, this.tables.history, cutoff)
      .filter((record): record is {
        resourceKind: "question" | "hypothesis" | "finding";
        resourceId: string;
      } => record.resourceKind === "question" ||
        record.resourceKind === "hypothesis" || record.resourceKind === "finding");
  }

  private deleteCurrent(
    resourceKind: "question" | "hypothesis" | "finding",
    table: string,
    snapshot: Question | Hypothesis | Finding,
    deletedAt: string
  ): void {
    this.db.transaction(() => {
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind,
        resourceId: snapshot.id,
        revision: snapshot.revision,
        snapshot,
        recordedAt: deletedAt
      });
      insertHistoryDeletion(this.db, this.tables.history, {
        resourceKind,
        resourceId: snapshot.id,
        revision: snapshot.revision + 1,
        recordedAt: deletedAt
      });
      this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(snapshot.id);
    })();
  }

  private tableFor(resourceKind: "question" | "hypothesis" | "finding"): string {
    switch (resourceKind) {
      case "question": return this.tables.questions;
      case "hypothesis": return this.tables.hypotheses;
      case "finding": return this.tables.findings;
    }
  }
}
