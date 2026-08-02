import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
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
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

const createTableNames = (projectId: string): InvestigationTableNames => {
  const root = `inv_${projectPrefix(projectId)}`;
  return {
    questions: `${root}_questions`,
    hypotheses: `${root}_hypotheses`,
    findings: `${root}_findings`
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
  createdBy: row.created_by as string,
  updatedBy: row.updated_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  ...optionalString("deletedAt", row.deleted_at)
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
  createdBy: row.created_by as string,
  updatedBy: row.updated_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  ...optionalString("deletedAt", row.deleted_at)
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
  createdBy: row.created_by as string,
  updatedBy: row.updated_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  ...optionalString("deletedAt", row.deleted_at)
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
        created_by           TEXT NOT NULL,
        updated_by           TEXT NOT NULL,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        deleted_at           TEXT
      );

      CREATE INDEX IF NOT EXISTS ${tables.questions}_recent
        ON ${tables.questions}(status, updated_at DESC)
        WHERE deleted_at IS NULL;

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
        created_by           TEXT NOT NULL,
        updated_by           TEXT NOT NULL,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        deleted_at           TEXT
      );

      CREATE INDEX IF NOT EXISTS ${tables.hypotheses}_recent
        ON ${tables.hypotheses}(status, updated_at DESC)
        WHERE deleted_at IS NULL;

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
        created_by             TEXT NOT NULL,
        updated_by             TEXT NOT NULL,
        created_at             TEXT NOT NULL,
        updated_at             TEXT NOT NULL,
        deleted_at             TEXT
      );

      CREATE INDEX IF NOT EXISTS ${tables.findings}_recent
        ON ${tables.findings}(status, updated_at DESC)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS ${tables.findings}_knowledge_source
        ON ${tables.findings}(knowledge_source_id)
        WHERE deleted_at IS NULL AND status = 'accepted';
    `);
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
           tags_json, created_by, updated_by, created_at, updated_at, deleted_at)
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
        question.createdBy,
        question.updatedBy,
        question.createdAt,
        question.updatedAt,
        question.deletedAt ?? null
      );
  }

  getQuestion(id: string): Question | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.questions} WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToQuestion(row) : undefined;
  }

  listQuestions(filter: QuestionFilter = {}): Question[] {
    const where = ["deleted_at IS NULL"];
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
    this.db
      .prepare(`
        UPDATE ${this.tables.questions}
        SET text = ?, context = ?, current_answer = ?, assumptions_json = ?,
            status = ?, tags_json = ?, updated_by = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .run(
        question.text,
        question.context ?? null,
        question.currentAnswer ?? null,
        encodeJson(question.assumptions),
        question.status,
        encodeJson(question.tags),
        question.updatedBy,
        question.updatedAt,
        question.id
      );
  }

  softDeleteQuestion(id: string, updatedBy: string, deletedAt: string): void {
    this.db
      .prepare(`
        UPDATE ${this.tables.questions}
        SET updated_by = ?, updated_at = ?, deleted_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .run(updatedBy, deletedAt, deletedAt, id);
  }

  insertHypothesis(hypothesis: Hypothesis): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.hypotheses}
          (id, question_ids_json, statement, rationale, assumptions_json,
           status, confidence_level, created_by, updated_by, created_at,
           updated_at, deleted_at)
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
        hypothesis.createdBy,
        hypothesis.updatedBy,
        hypothesis.createdAt,
        hypothesis.updatedAt,
        hypothesis.deletedAt ?? null
      );
  }

  getHypothesis(id: string): Hypothesis | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.hypotheses} WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToHypothesis(row) : undefined;
  }

  listHypotheses(filter: HypothesisFilter = {}): Hypothesis[] {
    const where = ["hypothesis.deleted_at IS NULL"];
    const parameters: unknown[] = [];

    if (filter.status !== undefined) {
      where.push("hypothesis.status = ?");
      parameters.push(filter.status);
    }
    if (filter.questionId !== undefined) {
      where.push(`
        EXISTS (
          SELECT 1 FROM ${this.tables.questions} AS question
          WHERE question.id = ? AND question.deleted_at IS NULL
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
    this.db
      .prepare(`
        UPDATE ${this.tables.hypotheses}
        SET question_ids_json = ?, statement = ?, rationale = ?,
            assumptions_json = ?, status = ?, confidence_level = ?,
            updated_by = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .run(
        encodeJson(hypothesis.questionIds),
        hypothesis.statement,
        hypothesis.rationale ?? null,
        encodeJson(hypothesis.assumptions),
        hypothesis.status,
        hypothesis.confidenceLevel ?? null,
        hypothesis.updatedBy,
        hypothesis.updatedAt,
        hypothesis.id
      );
  }

  softDeleteHypothesis(id: string, updatedBy: string, deletedAt: string): void {
    this.db
      .prepare(`
        UPDATE ${this.tables.hypotheses}
        SET updated_by = ?, updated_at = ?, deleted_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .run(updatedBy, deletedAt, deletedAt, id);
  }

  insertFinding(finding: Finding): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.findings}
          (id, claim, references_json, commentary, status, tags_json,
           question_links_json, hypothesis_links_json, knowledge_source_id,
           created_by, updated_by, created_at, updated_at, deleted_at)
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
        finding.createdBy,
        finding.updatedBy,
        finding.createdAt,
        finding.updatedAt,
        finding.deletedAt ?? null
      );
  }

  getFinding(id: string): Finding | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.findings} WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToFinding(row) : undefined;
  }

  listFindings(filter: FindingFilter = {}): Finding[] {
    const where = ["finding.deleted_at IS NULL"];
    const parameters: unknown[] = [];

    if (filter.status !== undefined) {
      where.push("finding.status = ?");
      parameters.push(filter.status);
    }
    if (filter.questionId !== undefined) {
      where.push(`
        EXISTS (
          SELECT 1 FROM ${this.tables.questions} AS question
          WHERE question.id = ? AND question.deleted_at IS NULL
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
          WHERE hypothesis.id = ? AND hypothesis.deleted_at IS NULL
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
    this.db
      .prepare(`
        UPDATE ${this.tables.findings}
        SET claim = ?, references_json = ?, commentary = ?, status = ?,
            tags_json = ?, question_links_json = ?, hypothesis_links_json = ?,
            knowledge_source_id = ?, updated_by = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .run(
        finding.claim,
        encodeJson(finding.references),
        finding.commentary ?? null,
        finding.status,
        encodeJson(finding.tags),
        encodeJson(finding.questionLinks),
        encodeJson(finding.hypothesisLinks),
        finding.knowledgeSourceId ?? null,
        finding.updatedBy,
        finding.updatedAt,
        finding.id
      );
  }

  softDeleteFinding(id: string, updatedBy: string, deletedAt: string): void {
    this.db
      .prepare(`
        UPDATE ${this.tables.findings}
        SET knowledge_source_id = NULL, updated_by = ?, updated_at = ?, deleted_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
      .run(updatedBy, deletedAt, deletedAt, id);
  }

  acceptFindingIfClaimMatches(
    id: string,
    expectedClaim: string,
    knowledgeSourceId: string,
    updatedBy: string,
    updatedAt: string
  ): boolean {
    const result = this.db
      .prepare(`
        UPDATE ${this.tables.findings}
        SET status = 'accepted', knowledge_source_id = ?, updated_by = ?, updated_at = ?
        WHERE id = ? AND claim = ? AND deleted_at IS NULL
      `)
      .run(knowledgeSourceId, updatedBy, updatedAt, id, expectedClaim);
    return result.changes === 1;
  }
}
