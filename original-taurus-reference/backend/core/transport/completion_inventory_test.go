package transport

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"go/ast"
	"go/format"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/endpoint"
)

const (
	routeInventoryStart = "<!-- BEGIN GENERATED ROUTE INVENTORY -->"
	routeInventoryEnd   = "<!-- END GENERATED ROUTE INVENTORY -->"
)

type completionRoute struct {
	Method        string
	Path          string
	Operation     string
	Handler       string
	Owner         string
	Scope         string
	Middleware    string
	Context       string
	References    string
	Dispatch      string
	SerialKey     string
	Mutation      string
	ErrorContract string
	Packet        string
}

// TestCompletionRouteInventory derives the committed inventory from routes.go
// and the real dispatch maps. It is both a drift gate and the export seam used by
// scripts/acceptance/omega-route-inventory.sh; there is no second handwritten
// route list to keep synchronized.
func TestCompletionRouteInventory(t *testing.T) {
	rows := completionRoutes(t)
	generated := renderCompletionRoutes(rows)
	inventoryPath := filepath.Join("..", "..", "docs", "completion", "route-scope-inventory.md")

	if os.Getenv("OMEGA_UPDATE_COMPLETION_INVENTORIES") == "1" {
		updateGeneratedSection(t, inventoryPath, routeInventoryStart, routeInventoryEnd, generated)
	}
	assertGeneratedSection(t, inventoryPath, routeInventoryStart, routeInventoryEnd, generated)
}

func completionRoutes(t *testing.T) []completionRoute {
	t.Helper()
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "routes.go", nil, parser.SkipObjectResolution)
	if err != nil {
		t.Fatal(err)
	}

	routeMethods := map[string]bool{
		"GET": true, "POST": true, "PUT": true, "PATCH": true,
		"DELETE": true, "Any": true,
	}
	var rows []completionRoute
	ast.Inspect(file, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || !routeMethods[selector.Sel.Name] || len(call.Args) < 2 {
			return true
		}
		receiver, ok := selector.X.(*ast.Ident)
		if !ok || (receiver.Name != "e" && receiver.Name != "gated" && receiver.Name != "scoped") {
			return true
		}
		path, ok := stringLiteral(call.Args[0])
		if !ok {
			t.Errorf("route %s.%s has a non-literal path", receiver.Name, selector.Sel.Name)
			return true
		}

		method := strings.ToUpper(selector.Sel.Name)
		if selector.Sel.Name == "Any" {
			method = "*"
		}
		op, asyncSpec := operationFromHandler(t, fset, method, path, call.Args[1])
		handler := completionHandler(t, fset, call.Args[1])
		mode, serialKey := completionDispatch(t, op, asyncSpec)
		scope := completionScope(t, receiver.Name, method, path)
		owner := completionOwner(t, op)
		middleware := completionMiddleware(receiver.Name, method, path, call.Args[2:], fset, t)

		rows = append(rows, completionRoute{
			Method:        method,
			Path:          path,
			Operation:     op,
			Handler:       handler,
			Owner:         owner,
			Scope:         scope,
			Middleware:    middleware,
			Context:       completionContext(t, scope),
			References:    completionReferences(op),
			Dispatch:      mode,
			SerialKey:     serialKey,
			Mutation:      completionMutation(op, method),
			ErrorContract: completionErrors(op, receiver.Name, path),
			Packet:        completionPacket(t, op),
		})
		return true
	})

	installed := make(map[string]int)
	for _, row := range rows {
		if _, ok := operationMode[row.Operation]; ok {
			installed[row.Operation]++
		}
	}
	for op := range operationMode {
		if installed[op] != 1 {
			t.Errorf("dispatch operation %q is installed on %d routes, want exactly 1", op, installed[op])
		}
	}
	if len(rows) == 0 {
		t.Fatal("route parser found no routes")
	}
	return rows
}

func operationFromHandler(t *testing.T, fset *token.FileSet, method, path string, expr ast.Expr) (string, string) {
	t.Helper()
	var op, asyncSpec string
	ast.Inspect(expr, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || selector.Sel.Name != "dispatchScoped" || len(call.Args) != 3 {
			return true
		}
		receiver, ok := selector.X.(*ast.Ident)
		if !ok || receiver.Name != "s" {
			return true
		}
		value, ok := stringLiteral(call.Args[0])
		if !ok {
			t.Fatalf("%s %s has a non-literal operation", method, path)
		}
		op = value
		if _, nilSpec := call.Args[2].(*ast.Ident); !nilSpec {
			asyncSpec = formatNode(t, fset, call.Args[2])
		}
		return false
	})
	if op != "" {
		return op, asyncSpec
	}
	switch method + " " + path {
	case "GET /healthz":
		return "health.get", ""
	case "POST /auth/register":
		return "auth.register", ""
	case "POST /auth/login":
		return "auth.login", ""
	case "POST /echo":
		return "echo.post", ""
	case "* /*":
		return "transport.not_found", ""
	default:
		t.Fatalf("route %s %s does not use dispatchScoped and has no baseline classification", method, path)
		return "", ""
	}
}

func completionHandler(t *testing.T, fset *token.FileSet, expr ast.Expr) string {
	t.Helper()
	var handler string
	ast.Inspect(expr, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || selector.Sel.Name != "dispatchScoped" || len(call.Args) != 3 {
			return true
		}
		handler = formatNode(t, fset, call.Args[1])
		return false
	})
	if handler != "" {
		return handler
	}
	return formatNode(t, fset, expr)
}

func completionDispatch(t *testing.T, op, asyncSpec string) (string, string) {
	t.Helper()
	mode, ok := operationMode[op]
	if !ok {
		return "direct", "—"
	}
	switch mode {
	case dispatchConcurrent:
		return "concurrent", "—"
	case dispatchDeferred:
		if asyncSpec == "" {
			t.Fatalf("deferred operation %q has no deferredSpec", op)
		}
		return "deferred", "durable job spec"
	case dispatchSerial:
		key, ok := operationSerialKey[op]
		if !ok {
			t.Fatalf("serial operation %q has no key", op)
		}
		param := key(endpoint.Request{Param: func(name string) string { return name }})
		if param == "" {
			t.Fatalf("serial operation %q produced an empty key description", op)
		}
		return "serial", "path:" + param
	default:
		t.Fatalf("operation %q has unknown mode %d", op, mode)
		return "", ""
	}
}

func completionScope(t *testing.T, receiver, method, path string) string {
	t.Helper()
	switch receiver {
	case "e":
		return "public"
	case "scoped":
		if strings.HasPrefix(path, "/dev/") {
			return "operator"
		}
		return "project_execution"
	case "gated":
		switch {
		case strings.HasPrefix(path, "/dev/jobs"):
			return "operator"
		case strings.HasPrefix(path, "/organizations"):
			return "organization_admin"
		case strings.HasPrefix(path, "/projects/") && (strings.Contains(path, "/names") || strings.Contains(path, "/evaluate") || strings.Contains(path, "/identities")):
			return "project_execution"
		case strings.HasPrefix(path, "/projects"), strings.HasPrefix(path, "/join/"), strings.HasPrefix(path, "/session/project"):
			return "project_directory"
		default:
			return "user"
		}
	default:
		t.Fatalf("%s %s has unknown route receiver %q", method, path, receiver)
		return ""
	}
}

func completionOwner(t *testing.T, op string) string {
	t.Helper()
	prefix := strings.Split(op, ".")[0]
	owners := map[string]string{
		"activity":      "capability/activity",
		"agent":         "capability/agent",
		"auth":          "capability/access",
		"chats":         "capability/chat",
		"collaboration": "capability/presence + activity + document",
		"comments":      "capability/comment",
		"connectors":    "capability/connector",
		"contexts":      "capability/contexts",
		"documents":     "capability/document",
		"echo":          "transport",
		"files":         "capability/file",
		"health":        "transport",
		"identities":    "capability/access + persona",
		"intelligence":  "capability/intelligence",
		"jobs":          "platform/job",
		"knowledge":     "capability/knowledge",
		"names":         "capability/formula/names",
		"notifications": "capability/notification",
		"organizations": "capability/organization",
		"personas":      "capability/persona",
		"projects":      "capability/access",
		"references":    "capability/reference",
		"resources":     "capability/resource",
		"sessions":      "capability/session",
		"transport":     "transport",
		"users":         "capability/access",
		"workspace":     "capability/workspace",
	}
	owner, ok := owners[prefix]
	if !ok {
		t.Fatalf("operation %q has no owner classification", op)
	}
	return owner
}

func completionMiddleware(receiver, method, path string, extra []ast.Expr, fset *token.FileSet, t *testing.T) string {
	t.Helper()
	parts := []string{"Recover", "BodyLimit", "Secure", "requestlog?"}
	switch receiver {
	case "gated":
		parts = append(parts, "requireUser")
	case "scoped":
		parts = append(parts, "requireProject", "documentAccessGuard?", "sessionActivity?")
	}
	if receiver != "e" && method != "GET" {
		parts = append(parts, "requireCSRF")
	}
	if path == "/auth/register" || path == "/auth/login" {
		parts = append(parts, "auth rate-limit")
	}
	if method == "POST" && path == "/files" {
		parts = append(parts, "32M upload limit")
	}
	for _, expr := range extra {
		rendered := formatNode(t, fset, expr)
		if !strings.Contains(strings.Join(parts, ","), rendered) {
			parts = append(parts, rendered)
		}
	}
	return strings.TrimSpace(strings.Join(parts, " → "))
}

func completionContext(t *testing.T, scope string) string {
	t.Helper()
	switch scope {
	case "public":
		return "none"
	case "user":
		return "SubjectUser"
	case "organization_admin":
		return "SubjectUser; handler checks org role"
	case "project_directory":
		return "SubjectUser; handler checks membership/action"
	case "project_execution":
		return "SubjectUser + authorized Project"
	case "operator":
		return "signed-in; scoped /dev also requires Project; operator authorization absent → Ω-043"
	default:
		t.Fatalf("scope %q has no required-context classification", scope)
		return ""
	}
}

func completionReferences(op string) string {
	prefix := strings.Split(op, ".")[0]
	refs := map[string]string{
		"activity":      "actor + resource snapshot",
		"agent":         "task + persona + document IDs",
		"auth":          "user/session",
		"chats":         "chat + turn + persona/task/file IDs",
		"collaboration": "document + user + activity IDs",
		"comments":      "document + anchor + comment IDs",
		"connectors":    "connector + provider-file/source IDs",
		"contexts":      "context + resource/source refs",
		"documents":     "document + row/block/change IDs",
		"files":         "file + uploader/project IDs",
		"identities":    "user/persona IDs",
		"jobs":          "job IDs; payload omitted",
		"knowledge":     "source IDs + retrieval evidence",
		"names":         "project formula names",
		"notifications": "free-text toast; may name resources",
		"organizations": "organization + member IDs",
		"personas":      "persona/version/task IDs",
		"projects":      "project + member/link IDs",
		"references":    "both resource-edge endpoints",
		"resources":     "kind + family-owned resource ID",
		"sessions":      "user + current document/caret IDs",
		"users":         "user profile ID",
		"workspace":     "opaque user-project state",
	}
	if value := refs[prefix]; value != "" {
		return value
	}
	return "none"
}

func completionMutation(op, method string) string {
	switch op {
	case "documents.append_changes":
		return "revision CAS + submission idempotency; atomic history/activity"
	case "documents.undo", "documents.redo":
		return "head-revision guard; compensating ChangeSet"
	case "documents.rebase":
		return "monotonic base_seq guard; retryable job"
	case "documents.resolve":
		return "durable retry job; result writes ChangeSet"
	case "agent.plans.create", "agent.actions.create":
		return "durable task + queued agent.run; no public idempotency key"
	case "connectors.sync":
		return "fingerprint/retry-bounded reconciliation; sliced commits"
	}
	if method == "GET" || method == "*" {
		return "read-only"
	}
	return "no public revision/idempotency contract"
}

func completionErrors(op, receiver, path string) string {
	flags := []string{"stable JSON error; hidden foreign IDs generally 404"}
	switch op {
	case "auth.login", "auth.register":
		flags = []string{"non-enumerating auth error; credentials redacted"}
	case "activity.list", "sessions.list", "contexts.resolved", "references.list", "references.backlinks", "knowledge.retrieve":
		flags = append(flags, "CALLER-BLIND READ → Ω-009/Ω-010")
	case "documents.list", "resources.list":
		flags = append(flags, "caller filter lives above owning read (partial) → Ω-009")
	}
	if strings.HasPrefix(op, "connectors.") {
		flags = append(flags, "FILESYSTEM/URL/SOURCE ADMISSION → Ω-007")
	}
	if receiver == "scoped" && strings.Contains(path, ":documentID") {
		flags = append(flags, "document guard FAILS OPEN on resolver error → Ω-009")
	}
	return strings.Join(flags, "; ")
}

func completionPacket(t *testing.T, op string) string {
	t.Helper()
	prefix := strings.Split(op, ".")[0]
	packets := map[string]string{
		"activity": "Ω-010/Ω-018", "agent": "Ω-019", "auth": "Ω-040/Ω-041",
		"chats": "Ω-025/Ω-026", "collaboration": "Ω-014", "comments": "Ω-017",
		"connectors": "Ω-007/Ω-032", "contexts": "Ω-015/Ω-039",
		"documents": "Ω-006/Ω-016/Ω-017", "echo": "Ω-043", "files": "Ω-015/Ω-042",
		"health": "Ω-043", "identities": "Ω-040", "intelligence": "Ω-008",
		"jobs": "Ω-014", "knowledge": "Ω-002/Ω-003/Ω-005/Ω-031",
		"names": "Ω-022", "notifications": "Ω-014", "organizations": "Ω-040/Ω-041",
		"personas": "Ω-019/Ω-039", "projects": "Ω-011/Ω-040/Ω-041",
		"references": "Ω-009/Ω-017", "resources": "Ω-009/Ω-015",
		"sessions": "Ω-014", "transport": "Ω-043", "users": "Ω-040/Ω-041",
		"workspace": "Ω-012",
	}
	packet, ok := packets[prefix]
	if !ok {
		t.Fatalf("operation %q has no packet ownership", op)
	}
	return packet
}

func renderCompletionRoutes(rows []completionRoute) string {
	var canonical strings.Builder
	for _, row := range rows {
		fmt.Fprintf(&canonical, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			row.Method, row.Path, row.Operation, row.Handler, row.Owner, row.Scope,
			row.Middleware, row.Context, row.References, row.Dispatch, row.SerialKey,
			row.Mutation, row.ErrorContract, row.Packet)
	}
	sum := sha256.Sum256([]byte(canonical.String()))

	counts := map[string]int{}
	modes := map[string]int{}
	for _, row := range rows {
		counts[row.Scope]++
		modes[row.Dispatch]++
	}
	scopes := make([]string, 0, len(counts))
	for scope := range counts {
		scopes = append(scopes, scope)
	}
	sort.Strings(scopes)

	var out strings.Builder
	fmt.Fprintf(&out, "%s\n\n", routeInventoryStart)
	fmt.Fprintf(&out, "Generated from `core/transport/routes.go`, `operationMode`, and `operationSerialKey`.\n\n")
	fmt.Fprintf(&out, "- Routes: **%d** total; dispatch operations: **%d**\n", len(rows), len(operationMode))
	fmt.Fprintf(&out, "- Dispatch: concurrent **%d**, serial **%d**, deferred **%d**, direct **%d**\n",
		modes["concurrent"], modes["serial"], modes["deferred"], modes["direct"])
	fmt.Fprintf(&out, "- Scope counts:")
	for _, scope := range scopes {
		fmt.Fprintf(&out, " `%s` **%d**", scope, counts[scope])
	}
	fmt.Fprintf(&out, "\n- Canonical SHA-256: `%s`\n\n", hex.EncodeToString(sum[:]))
	out.WriteString("| Method/path | Operation | Handler / owner | Scope / current middleware | Required context | Response references | Dispatch / serial key | Revision, idempotency, transaction | Error/redaction contract | Completion packet |\n")
	out.WriteString("|---|---|---|---|---|---|---|---|---|---|\n")
	for _, row := range rows {
		fmt.Fprintf(&out, "| `%s %s` | `%s` | `%s`<br>%s | `%s`<br>%s | %s | %s | %s / %s | %s | %s | %s |\n",
			row.Method, row.Path, row.Operation, escapeTable(row.Handler), row.Owner,
			row.Scope, escapeTable(row.Middleware), escapeTable(row.Context),
			escapeTable(row.References), row.Dispatch, row.SerialKey,
			escapeTable(row.Mutation), escapeTable(row.ErrorContract), row.Packet)
	}
	fmt.Fprintf(&out, "\n%s\n", routeInventoryEnd)
	return out.String()
}

func updateGeneratedSection(t *testing.T, path, start, end, generated string) {
	t.Helper()
	current, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	before, _, after, ok := splitGeneratedSection(string(current), start, end)
	if !ok {
		t.Fatalf("%s is missing generated markers", path)
	}
	next := before + generated + after
	if err := os.WriteFile(path, []byte(next), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertGeneratedSection(t *testing.T, path, start, end, want string) {
	t.Helper()
	current, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	_, got, _, ok := splitGeneratedSection(string(current), start, end)
	if !ok {
		t.Fatalf("%s is missing generated markers", path)
	}
	if got != want {
		t.Fatalf("%s is stale; run ./scripts/acceptance/omega-route-inventory.sh --update", path)
	}
}

func splitGeneratedSection(input, start, end string) (before, section, after string, ok bool) {
	startAt := strings.Index(input, start)
	endAt := strings.Index(input, end)
	if startAt < 0 || endAt < startAt {
		return "", "", "", false
	}
	endAt += len(end)
	if endAt < len(input) && input[endAt] == '\n' {
		endAt++
	}
	return input[:startAt], input[startAt:endAt], input[endAt:], true
}

func formatNode(t *testing.T, fset *token.FileSet, node ast.Node) string {
	t.Helper()
	var buf bytes.Buffer
	if err := format.Node(&buf, fset, node); err != nil {
		t.Fatal(err)
	}
	return buf.String()
}

func stringLiteral(expr ast.Expr) (string, bool) {
	literal, ok := expr.(*ast.BasicLit)
	if !ok || literal.Kind != token.STRING {
		return "", false
	}
	value, err := strconv.Unquote(literal.Value)
	return value, err == nil
}

func escapeTable(value string) string {
	value = strings.ReplaceAll(value, "|", "\\|")
	value = strings.ReplaceAll(value, "\n", " ")
	return value
}
