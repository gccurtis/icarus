package sqlite

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

const (
	persistenceInventoryStart = "<!-- BEGIN GENERATED PERSISTENCE INVENTORY -->"
	persistenceInventoryEnd   = "<!-- END GENERATED PERSISTENCE INVENTORY -->"
)

type completionTable struct {
	Name        string
	Owner       string
	Columns     []string
	Scope       string
	Caller      string
	Authority   string
	Constraints string
	Mutation    string
	Retention   string
	Boundary    string
}

type completionIndex struct {
	Name    string
	Table   string
	Columns string
	Unique  bool
	Origin  string
}

func TestCompletionPersistenceInventory(t *testing.T) {
	fresh := openCompletionStore(t, filepath.Join(t.TempDir(), "fresh.db"))
	defer fresh.Close()

	upgraded := openLegacyCompletionStore(t, filepath.Join(t.TempDir(), "upgrade.db"))
	defer upgraded.Close()

	freshSchema := completionSchema(t, fresh.db)
	upgradedSchema := completionSchema(t, upgraded.db)
	if freshSchema != upgradedSchema {
		t.Fatal("fresh and representative upgraded databases do not converge to the same schema")
	}

	var email, name, color, avatar string
	if err := upgraded.db.QueryRow(
		`SELECT email, name, color, avatar_url FROM users WHERE id = ?`,
		"fixture-user-hash",
	).Scan(&email, &name, &color, &avatar); err != nil {
		t.Fatalf("read preserved upgrade fixture: %v", err)
	}
	if email != "fixture@example.invalid" || name != "" || color != "" || avatar != "" {
		t.Fatalf("upgrade fixture changed: email=%q name=%q color=%q avatar=%q", email, name, color, avatar)
	}

	tables := completionTables(t, fresh.db)
	indexes := completionIndexes(t, fresh.db)
	generated := renderCompletionPersistence(tables, indexes, freshSchema)
	inventoryPath := filepath.Join("..", "..", "..", "..", "docs", "completion", "persistence-inventory.md")
	if os.Getenv("OMEGA_UPDATE_COMPLETION_INVENTORIES") == "1" {
		updatePersistenceSection(t, inventoryPath, generated)
	}
	assertPersistenceSection(t, inventoryPath, generated)
}

func openCompletionStore(t *testing.T, path string) *Store {
	t.Helper()
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func openLegacyCompletionStore(t *testing.T, path string) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE users (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		created_at TEXT NOT NULL
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(
		`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`,
		"fixture-user-hash", "fixture@example.invalid", "fixture-password-hash", "2026-01-01T00:00:00Z",
	); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	return openCompletionStore(t, path)
}

func completionSchema(t *testing.T, db *sql.DB) string {
	t.Helper()
	rows, err := db.Query(`
		SELECT type, name, tbl_name, COALESCE(sql, '')
		FROM sqlite_schema
		WHERE name NOT LIKE 'sqlite_%'
		ORDER BY type, name
	`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var out strings.Builder
	for rows.Next() {
		var kind, name, table, statement string
		if err := rows.Scan(&kind, &name, &table, &statement); err != nil {
			t.Fatal(err)
		}
		fmt.Fprintf(&out, "%s\t%s\t%s\t%s\n", kind, name, table, strings.Join(strings.Fields(statement), " "))
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out.String()
}

func completionTables(t *testing.T, db *sql.DB) []completionTable {
	t.Helper()
	rows, err := db.Query(`
		SELECT name
		FROM sqlite_schema
		WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
		ORDER BY name
	`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var tables []completionTable
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		columns := completionColumns(t, db, name)
		tables = append(tables, completionTable{
			Name:        name,
			Owner:       completionTableOwner(t, name),
			Columns:     columns,
			Scope:       completionTableScope(name, columns),
			Caller:      completionTableCaller(name),
			Authority:   completionTableAuthority(name),
			Constraints: completionTableConstraints(t, db, name),
			Mutation:    completionTableMutation(name),
			Retention:   completionTableRetention(name),
			Boundary:    completionTableBoundary(name),
		})
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(tables) != 46 {
		t.Fatalf("schema has %d application tables, want the classified baseline of 46", len(tables))
	}
	return tables
}

func completionColumns(t *testing.T, db *sql.DB, table string) []string {
	t.Helper()
	rows, err := db.Query(`PRAGMA table_info("` + table + `")`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var columns []string
	for rows.Next() {
		var cid, notnull, pk int
		var name, kind string
		var defaultValue any
		if err := rows.Scan(&cid, &name, &kind, &notnull, &defaultValue, &pk); err != nil {
			t.Fatal(err)
		}
		columns = append(columns, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return columns
}

func completionIndexes(t *testing.T, db *sql.DB) []completionIndex {
	t.Helper()
	rows, err := db.Query(`
		SELECT name, tbl_name, COALESCE(sql, '')
		FROM sqlite_schema
		WHERE type = 'index'
		ORDER BY name
	`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var indexes []completionIndex
	for rows.Next() {
		var index completionIndex
		var statement string
		if err := rows.Scan(&index.Name, &index.Table, &statement); err != nil {
			t.Fatal(err)
		}
		if statement == "" {
			index.Unique = true
			index.Origin = "automatic PK/UNIQUE constraint"
		} else {
			index.Unique = strings.HasPrefix(strings.ToUpper(statement), "CREATE UNIQUE INDEX")
			index.Origin = "explicit schema index"
		}
		index.Columns = completionIndexColumns(t, db, index.Name)
		indexes = append(indexes, index)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	var explicit int
	for _, index := range indexes {
		if index.Origin == "explicit schema index" {
			explicit++
		}
	}
	if explicit != 30 {
		t.Fatalf("schema has %d explicit indexes, want the classified baseline of 30", explicit)
	}
	return indexes
}

func completionIndexColumns(t *testing.T, db *sql.DB, index string) string {
	t.Helper()
	rows, err := db.Query(`PRAGMA index_info("` + index + `")`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var columns []string
	for rows.Next() {
		var seq, cid int
		var name string
		if err := rows.Scan(&seq, &cid, &name); err != nil {
			t.Fatal(err)
		}
		columns = append(columns, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return strings.Join(columns, ", ")
}

func completionTableOwner(t *testing.T, table string) string {
	t.Helper()
	owners := map[string]string{
		"activity_events":               "capability/activity.Store",
		"agent_chat_attachments":        "capability/chat.AttachmentStore",
		"agent_chat_turns":              "capability/chat.ChatStore",
		"agent_chats":                   "capability/chat.ChatStore",
		"agent_tasks":                   "capability/agent.TaskStore",
		"change_sets":                   "capability/document.Store",
		"comment_replies":               "capability/comment.Store",
		"connectors":                    "capability/connector.Store",
		"contexts":                      "capability/contexts.Store",
		"document_anchors":              "capability/document.Store",
		"document_comments":             "capability/comment.Store",
		"document_history":              "capability/document.Store",
		"document_submissions":          "capability/document.Store",
		"documents":                     "capability/document.Store",
		"files":                         "capability/file.Store",
		"formula_names":                 "capability/formula/names.NameStore",
		"jobs":                          "platform/job.Store",
		"knowledge_corpus_edges":        "capability/knowledge.Store",
		"knowledge_corpus_index":        "capability/knowledge.Store",
		"knowledge_corpus_state":        "capability/knowledge.Store",
		"knowledge_embedding_spaces":    "capability/knowledge.GenerationStore",
		"knowledge_generation_events":   "capability/knowledge.GenerationStore",
		"knowledge_generations":         "capability/knowledge.GenerationStore",
		"knowledge_lattice_state":       "capability/knowledge.GenerationStore",
		"knowledge_memberships":         "capability/knowledge.Store",
		"knowledge_nodes":               "capability/knowledge.Store",
		"knowledge_reembed_checkpoints": "capability/knowledge.GenerationStore",
		"knowledge_reembed_previews":    "capability/knowledge.GenerationStore",
		"knowledge_reembed_runs":        "capability/knowledge.GenerationStore",
		"knowledge_source_changes":      "capability/knowledge.GenerationStore",
		"knowledge_sources":             "capability/knowledge.Store",
		"knowledge_windows":             "capability/knowledge.Store",
		"memberships":                   "capability/access.MembershipStore",
		"org_memberships":               "capability/organization.Store",
		"organizations":                 "capability/organization.Store",
		"persona_defaults":              "capability/persona.Store",
		"persona_versions":              "capability/persona.Store",
		"personas":                      "capability/persona.Store",
		"project_links":                 "capability/access.ProjectLinkStore",
		"project_sessions":              "capability/session.Store",
		"projects":                      "capability/access.ProjectStore",
		"resource_attributes":           "capability/resource.AttributeStore",
		"resource_references":           "capability/reference.Store",
		"sessions":                      "capability/access.SessionStore",
		"users":                         "capability/access.UserStore",
		"workspaces":                    "capability/workspace.Store",
	}
	owner, ok := owners[table]
	if !ok {
		t.Fatalf("table %q has no capability/store owner", table)
	}
	return owner
}

func completionTableScope(table string, columns []string) string {
	for _, column := range columns {
		if column == "project_id" {
			return "project_id"
		}
		if column == "org_id" {
			return "org_id"
		}
	}
	switch table {
	case "projects":
		return "project root (organization scope absent)"
	case "organizations":
		return "organization root"
	case "users", "sessions":
		return "user/global"
	case "jobs":
		return "payload-defined; no physical tenant column → Ω-014/Ω-042"
	case "change_sets", "document_history", "document_submissions", "document_anchors", "document_comments":
		return "document_id; project derived through document"
	case "comment_replies":
		return "comment_id; project derived through comment/document"
	case "knowledge_windows":
		return "local_ref_id; project derived through source"
	case "knowledge_memberships":
		return "parent/member IDs; project derived through node"
	default:
		return "parent-derived"
	}
}

func completionTableCaller(table string) string {
	switch table {
	case "users", "sessions":
		return "caller/user ID required above store"
	case "jobs":
		return "operator read is not tenant-scoped → Ω-014/Ω-042"
	case "activity_events", "contexts", "project_sessions", "resource_references":
		return "store accepts project but not caller → Ω-009/Ω-010"
	case "documents", "files", "agent_tasks", "agent_chats", "personas", "connectors":
		return "project-scoped reads exist; some ID-only mutations rely on handler authorization"
	case "change_sets", "document_history", "document_submissions", "document_anchors", "document_comments", "comment_replies":
		return "parent-ID reads; caller scope must be established before store"
	default:
		return "physical tenant/parent key; caller authorization remains above store"
	}
}

func completionTableAuthority(table string) string {
	switch {
	case table == "knowledge_embedding_spaces":
		return "canonical immutable embedding-space identity"
	case table == "knowledge_generations":
		return "durable lattice generation lifecycle record"
	case table == "knowledge_lattice_state":
		return "canonical active-generation pointer and source cursor"
	case table == "knowledge_source_changes":
		return "immutable source mutation/tombstone ledger"
	case table == "knowledge_reembed_previews":
		return "durable authorization and cost/size estimate"
	case table == "knowledge_reembed_runs", table == "knowledge_reembed_checkpoints":
		return "durable re-embed execution control and accounting"
	case table == "knowledge_generation_events":
		return "immutable generation audit/outbox fact"
	case strings.HasPrefix(table, "knowledge_") && table != "knowledge_sources":
		return "derived/rebuildable retrieval artifact"
	case table == "activity_events":
		return "immutable derived audit fact"
	case table == "document_history":
		return "derived immutable summary ledger"
	case table == "jobs":
		return "durable execution control"
	case table == "project_sessions":
		return "ephemeral presence projection"
	case table == "knowledge_sources":
		return "canonical source identity; content remains at origin"
	default:
		return "canonical application record"
	}
}

func completionTableConstraints(t *testing.T, db *sql.DB, table string) string {
	t.Helper()
	rows, err := db.Query(`PRAGMA foreign_key_list("` + table + `")`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var foreignKeys []string
	for rows.Next() {
		var id, seq int
		var referencedTable, from, to, onUpdate, onDelete, match string
		if err := rows.Scan(&id, &seq, &referencedTable, &from, &to, &onUpdate, &onDelete, &match); err != nil {
			t.Fatal(err)
		}
		foreignKeys = append(foreignKeys, from+"→"+referencedTable+"."+to)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	sort.Strings(foreignKeys)
	if len(foreignKeys) == 0 {
		return "PK/UNIQUE only; no declared foreign key"
	}
	return "FK " + strings.Join(foreignKeys, ", ")
}

func completionTableMutation(table string) string {
	switch table {
	case "documents", "change_sets", "document_submissions", "document_history", "activity_events":
		return "document revision CAS/idempotency/history/activity share explicit transactions"
	case "jobs":
		return "immediate transaction claims one due job; retry/heartbeat state"
	case "agent_tasks":
		return "run ID/status transition guards; heartbeat and stale-task reap"
	case "persona_versions":
		return "version CAS in persona update transaction"
	case "knowledge_corpus_state", "knowledge_corpus_index", "knowledge_corpus_edges":
		return "dirty/built sequence prevents a racing rebuild from appearing current"
	case "knowledge_generations", "knowledge_lattice_state", "knowledge_generation_events":
		return "promotion/rollback pointer, lifecycle states, and event commit atomically under revision CAS"
	case "knowledge_source_changes":
		return "active add/replace/remove atomically advances the monotonic source cursor"
	case "knowledge_reembed_runs", "knowledge_reembed_checkpoints":
		return "idempotent run state; each shadow source, checkpoint, and usage receipt commits atomically"
	case "connectors":
		return "fingerprint + bounded retry state; sync writes are sliced"
	default:
		return "SQLite atomic statement or owning-store transaction; no public idempotency key"
	}
}

func completionTableRetention(table string) string {
	switch table {
	case "sessions":
		return "expires_at; deletion on logout (periodic purge not installed)"
	case "project_sessions":
		return "stale-session deletion is available"
	case "jobs":
		return "stale-running reap; completed/failed rows have no purge policy → Ω-042"
	case "change_sets":
		return "bounded prune supported; history summary retained"
	case "documents":
		return "trash lifecycle and age query; purge policy completion pending"
	case "knowledge_corpus_index", "knowledge_corpus_edges", "knowledge_memberships", "knowledge_nodes", "knowledge_windows":
		return "replaced/rebuilt with source/corpus reconciliation"
	case "knowledge_generations":
		return "previous complete generation retained through bounded rollback TTL"
	case "knowledge_generation_events", "knowledge_source_changes":
		return "append-only audit/cursor history; purge policy not installed"
	case "knowledge_reembed_previews", "knowledge_reembed_runs", "knowledge_reembed_checkpoints":
		return "retained for lifecycle recovery and accounting; purge policy not installed"
	default:
		return "retained until explicit owner delete; no time policy"
	}
}

func completionTableBoundary(table string) string {
	switch table {
	case "sessions":
		return "project_id is the legacy session-selected Project model → Ω-011"
	case "workspaces":
		return "opaque JSON is parked for the revisioned Workspace cutover → Ω-012"
	case "agent_chat_turns":
		return "linear turn rows are parked for the turn-tree migration → Ω-025"
	case "knowledge_sources":
		return "legacy whole-source text column is retained blank; bytes come from origin"
	case "files":
		return "content BLOB inline in SQLite → object-storage boundary Ω-042"
	case "documents":
		return "base JSON inline; bounded ChangeSet tail"
	case "change_sets":
		return "ops/inverse/summary JSON inline; pruning boundary"
	case "knowledge_windows", "knowledge_nodes":
		return "legacy JSON vectors plus BLOB v2 during compatibility migration"
	case "knowledge_corpus_index", "knowledge_corpus_edges":
		return "derived packed float32/index BLOBs inline"
	case "agent_tasks", "jobs":
		return "JSON content/payload inline; avoid secrets and large binaries"
	default:
		return "small relational/text record"
	}
}

func renderCompletionPersistence(tables []completionTable, indexes []completionIndex, schema string) string {
	sum := sha256.Sum256([]byte(schema))
	var explicitIndexes int
	for _, index := range indexes {
		if index.Origin == "explicit schema index" {
			explicitIndexes++
		}
	}
	var out strings.Builder
	fmt.Fprintf(&out, "%s\n\n", persistenceInventoryStart)
	fmt.Fprintf(&out, "Generated by opening the real SQLite store, reading `sqlite_schema` and PRAGMA metadata, and comparing a fresh database with a representative upgraded database.\n\n")
	fmt.Fprintf(&out, "- Application tables: **%d**; indexes: **%d** total (**%d** explicit, **%d** automatic constraint indexes)\n",
		len(tables), len(indexes), explicitIndexes, len(indexes)-explicitIndexes)
	fmt.Fprintf(&out, "- Normalized schema SHA-256: `%s`\n", hex.EncodeToString(sum[:]))
	fmt.Fprintf(&out, "- Upgrade fixture: legacy `users` row `fixture-user-hash` survives and receives current column defaults.\n\n")
	out.WriteString("| Table / owner | Columns | Physical scope / caller awareness | Authority | Constraints | Transaction, replay, CAS | Retention | Large/legacy boundary |\n")
	out.WriteString("|---|---|---|---|---|---|---|---|\n")
	for _, table := range tables {
		fmt.Fprintf(&out, "| `%s`<br>%s | %s | %s<br>%s | %s | %s | %s | %s | %s |\n",
			table.Name, table.Owner, strings.Join(table.Columns, ", "),
			table.Scope, table.Caller, table.Authority, table.Constraints,
			table.Mutation, table.Retention, table.Boundary)
	}
	out.WriteString("\n| Index | Table | Columns | Unique | Origin |\n")
	out.WriteString("|---|---|---|---|---|\n")
	for _, index := range indexes {
		fmt.Fprintf(&out, "| `%s` | `%s` | %s | %t | %s |\n",
			index.Name, index.Table, index.Columns, index.Unique, index.Origin)
	}
	fmt.Fprintf(&out, "\n%s\n", persistenceInventoryEnd)
	return out.String()
}

func updatePersistenceSection(t *testing.T, path, generated string) {
	t.Helper()
	current, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	before, _, after, ok := splitPersistenceSection(string(current))
	if !ok {
		t.Fatalf("%s is missing generated markers", path)
	}
	if err := os.WriteFile(path, []byte(before+generated+after), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertPersistenceSection(t *testing.T, path, want string) {
	t.Helper()
	current, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	_, got, _, ok := splitPersistenceSection(string(current))
	if !ok {
		t.Fatalf("%s is missing generated markers", path)
	}
	if got != want {
		t.Fatalf("%s is stale; run OMEGA_UPDATE_COMPLETION_INVENTORIES=1 go test ./core/platform/storage/sqlite -run TestCompletionPersistenceInventory", path)
	}
}

func splitPersistenceSection(input string) (before, section, after string, ok bool) {
	startAt := strings.Index(input, persistenceInventoryStart)
	endAt := strings.Index(input, persistenceInventoryEnd)
	if startAt < 0 || endAt < startAt {
		return "", "", "", false
	}
	endAt += len(persistenceInventoryEnd)
	if endAt < len(input) && input[endAt] == '\n' {
		endAt++
	}
	return input[:startAt], input[startAt:endAt], input[endAt:], true
}
