# chat.go

The chat capability: project-scoped AI conversations (Chat containers and ordered Turns) driven through an injected engine port. See repo conventions (AGENTS.md).

## Code breakdown

### Project scoping of the by-id read (DEF-1)

`ChatStore.ChatByID` takes the project id as its first parameter. The store is
expected to filter on it — the SQLite implementation puts it in the `WHERE`
clause — so a chat owned by another project is `ErrNotFound` rather than a row
handed back for the caller to vet. This finishes DEF-1 for chats, following the
in-SQL scoping record 0115 introduced for the file store; `MemoryChatStore`
mirrors it by comparing `ProjectID` on the map hit. `ChatAttachmentByID` is
scoped the same way.

`Get`, `PostTurn`, `SetPersona`, and `ownedChat` still compare
`chat.ProjectID != scope.ProjectID` after loading and still return
`ErrProjectScope`. That is **deliberately redundant** and must not be removed as
"now unnecessary": it is the layer that still holds if a store implementation
does not scope, and the SQL predicate is the layer that still holds if a caller
forgets the comparison. Neither is load-bearing alone.

One visible consequence: because the store answers first, cross-project access
through these services now surfaces as `ErrNotFound` rather than
`ErrProjectScope`. The chat handler already maps both to the same 404, so the
HTTP contract is unchanged — and a project can no longer distinguish "not yours"
from "does not exist", which is the stronger property.

```go
// Package chat owns project-scoped AI conversations: durable Chat containers and
// their ordered Turns. A chat is a first-class Project resource, kept separate
// from the agent capability that executes a turn. Each turn is driven through an
// injected ChatEngine port, so this capability never imports agent, intelligence,
// or persona; the composition root supplies the engine adapter.
package chat

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
)

// Chat modes. A chat drives one workflow per turn: Ask answers inline, Plan and
// Action spawn a durable task the client polls.
const (
	ModeAsk    = "ask"
	ModePlan   = "plan"
	ModeAction = "action"
)

// Turn roles.
const (
	RoleUser  = "user"
	RoleAgent = "agent"
)

const (
	maxTitleBytes   = 200
	maxMessageBytes = 16 * 1024
)

// Scope is trusted application context supplied after access has selected a
// Project. It is deliberately separate from any request field so request data
// cannot redirect a chat into another Project.
type Scope struct {
	ProjectID string
}

// Chat is a project-scoped, durable conversation container. ProjectID and
// RequesterID are assigned by application code, never by model or request input.
// ResourceID optionally associates the chat with an in-project resource (for
// example the open document).
type Chat struct {
	ID          string `json:"id"`
	ProjectID   string `json:"projectId"`
	RequesterID string `json:"requesterId"`
	Title       string `json:"title"`
	Mode        string `json:"mode"`
	ResourceID  string `json:"resourceId,omitempty"`
	// PersonaID selects the project-local persona this conversation's turns run
	// under (by id; its current version is resolved at turn time). Empty means the
	// requester's default persona, so behavior is unchanged until one is set.
	PersonaID string    `json:"personaId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Turn is one message in a chat: a user prompt or the agent's reply. TaskID is
// set when an agent turn spawned a durable Plan or Action task the client polls.
type Turn struct {
	ID        string    `json:"id"`
	ChatID    string    `json:"chatId"`
	ProjectID string    `json:"projectId"`
	Role      string    `json:"role"`
	Body      string    `json:"body"`
	TaskID    string    `json:"taskId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Usage carries the summed model cost of one turn so a live run can surface it.
// It is zero for Plan/Action turns, whose task reports usage when it later runs.
type Usage struct {
	PromptTokens int `json:"promptTokens"`
	TotalTokens  int `json:"totalTokens"`
}

// ChatReply is a chat engine's response to one user message: a synchronous
// answer Body (ask mode) and/or a spawned durable task the client polls, with
// the summed model Usage.
type ChatReply struct {
	Body   string
	TaskID string
	Usage  Usage
}

// ChatReplyRequest is the trusted input a Chats service hands its engine to
// produce one agent turn. It carries no Persona: the composition root's engine
// adapter resolves the requester's default Persona, so this capability stays free
// of the persona capability.
type ChatReplyRequest struct {
	Mode        string
	Message     string
	RequesterID string
	ResourceID  string
	// ChatID lets the engine adapter resolve this chat's attachments into
	// additional context for the turn.
	ChatID string
	// IncludeWeb asks an ask-mode turn to consult the live web (transient context).
	// It has effect only when the engine has a web retriever configured.
	IncludeWeb bool
	// PersonaID is the conversation's selected persona (by id; empty means the
	// requester's default). The engine adapter resolves it to a snapshot, so this
	// capability still holds no persona types.
	PersonaID string
}

// ChatEngine runs one chat turn through the appropriate workflow. It keeps the
// Chats service thin and free of the agent/intelligence capabilities; wiring
// supplies an adapter over the Ask and Workflows services.
type ChatEngine interface {
	Reply(Scope, ChatReplyRequest) (ChatReply, error)
}

// ChatStore persists chats and their ordered turns. Every lookup is proven
// against the trusted Project scope in the service, so a chat id is only
// meaningful inside its Project.
type ChatStore interface {
	CreateChat(Chat) error
	// ChatByID returns one chat scoped to its project: a chat owned by another
	// project is ErrNotFound. The service compares ProjectID afterwards anyway —
	// the two checks are deliberately redundant.
	ChatByID(projectID, id string) (Chat, error)
	ChatsByProject(projectID, resourceID string) ([]Chat, error)
	AppendTurn(Turn) error
	TurnsByChat(chatID string) ([]Turn, error)
	TouchChat(chatID string, at time.Time) error
	SetChatPersona(chatID, personaID string) error
}

// TurnResult is the full outcome of posting one turn: the persisted user and
// agent turns and the summed model usage for the reply.
type TurnResult struct {
	UserTurn  Turn  `json:"userTurn"`
	AgentTurn Turn  `json:"agentTurn"`
	Usage     Usage `json:"usage"`
}

var (
	ErrNotFound               = errors.New("chat: not found")
	ErrInvalid                = errors.New("chat: invalid")
	ErrInvalidScope           = errors.New("chat: Project scope is required")
	ErrProjectScope           = errors.New("chat: chat is outside the current Project")
	ErrAttachmentsUnavailable = errors.New("chat: attachments are not configured")
)

// Chats creates and drives project-scoped conversations over an injected engine.
// It is safe for concurrent callers when the supplied store is.
type Chats struct {
	store           ChatStore
	engine          ChatEngine
	attachments     AttachmentStore   // optional; nil = attachments disabled
	attachmentIndex AttachmentIndexer // optional; nil = attachments are not admitted to Knowledge
	now             func() time.Time
}

// NewChats constructs the chat service. A nil engine is valid for focused tests
// that do not post turns; PostTurn requires one.
func NewChats(store ChatStore, engine ChatEngine) (*Chats, error) {
	if store == nil {
		return nil, errors.New("chat: store is required")
	}
	return &Chats{store: store, engine: engine, now: time.Now}, nil
}

func validMode(mode string) bool {
	return mode == ModeAsk || mode == ModePlan || mode == ModeAction
}

// Create records a new chat in the trusted current Project.
func (c *Chats) Create(scope Scope, requesterID, mode, title, resourceID string) (Chat, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return Chat{}, ErrInvalidScope
	}
	if strings.TrimSpace(requesterID) == "" || !validMode(mode) || len(title) > maxTitleBytes {
		return Chat{}, ErrInvalid
	}
	now := c.now().UTC()
	chat := Chat{
		ID: newID(), ProjectID: scope.ProjectID, RequesterID: requesterID,
		Title: strings.TrimSpace(title), Mode: mode, ResourceID: strings.TrimSpace(resourceID),
		CreatedAt: now, UpdatedAt: now,
	}
	if err := c.store.CreateChat(chat); err != nil {
		return Chat{}, err
	}
	return chat, nil
}

// Get returns one chat and its ordered turns after proving Project ownership.
func (c *Chats) Get(scope Scope, chatID string) (Chat, []Turn, error) {
	chat, err := c.store.ChatByID(scope.ProjectID, chatID)
	if err != nil {
		return Chat{}, nil, err
	}
	if chat.ProjectID != scope.ProjectID {
		return Chat{}, nil, ErrProjectScope
	}
	turns, err := c.store.TurnsByChat(chatID)
	if err != nil {
		return Chat{}, nil, err
	}
	return chat, turns, nil
}

// List returns the current Project's chats, most-recently-updated first,
// optionally filtered to one in-project resource (empty = all).
func (c *Chats) List(scope Scope, resourceID string) ([]Chat, error) {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return nil, ErrInvalidScope
	}
	chats, err := c.store.ChatsByProject(scope.ProjectID, strings.TrimSpace(resourceID))
	if err != nil {
		return nil, err
	}
	sort.Slice(chats, func(i, j int) bool { return chats[i].UpdatedAt.After(chats[j].UpdatedAt) })
	return chats, nil
}

// PostTurn appends the user's message, runs it through the chat's mode via the
// engine, appends the agent's reply (recording any spawned task), and bumps the
// chat's activity time. It proves Project ownership before doing anything.
func (c *Chats) PostTurn(scope Scope, chatID, requesterID, message string, includeWeb bool) (TurnResult, error) {
	chat, err := c.store.ChatByID(scope.ProjectID, chatID)
	if err != nil {
		return TurnResult{}, err
	}
	if chat.ProjectID != scope.ProjectID {
		return TurnResult{}, ErrProjectScope
	}
	message = strings.TrimSpace(message)
	if message == "" || len(message) > maxMessageBytes || strings.TrimSpace(requesterID) == "" {
		return TurnResult{}, ErrInvalid
	}
	if c.engine == nil {
		return TurnResult{}, errors.New("chat: engine is required to post a turn")
	}
	userTurn := Turn{
		ID: newID(), ChatID: chat.ID, ProjectID: chat.ProjectID,
		Role: RoleUser, Body: message, CreatedAt: c.now().UTC(),
	}
	if err := c.store.AppendTurn(userTurn); err != nil {
		return TurnResult{}, err
	}
	reply, err := c.engine.Reply(scope, ChatReplyRequest{
		Mode: chat.Mode, Message: message, RequesterID: requesterID, ResourceID: chat.ResourceID,
		ChatID: chat.ID, IncludeWeb: includeWeb, PersonaID: chat.PersonaID,
	})
	if err != nil {
		return TurnResult{}, err
	}
	agentTurn := Turn{
		ID: newID(), ChatID: chat.ID, ProjectID: chat.ProjectID,
		Role: RoleAgent, Body: reply.Body, TaskID: reply.TaskID, CreatedAt: c.now().UTC(),
	}
	if err := c.store.AppendTurn(agentTurn); err != nil {
		return TurnResult{}, err
	}
	if err := c.store.TouchChat(chat.ID, c.now().UTC()); err != nil {
		return TurnResult{}, err
	}
	return TurnResult{UserTurn: userTurn, AgentTurn: agentTurn, Usage: reply.Usage}, nil
}

// SetPersona sets (or clears, with an empty id) the persona this chat's turns run
// under. The id is validated only at turn time — an unknown persona surfaces
// when the engine resolves it — so this capability stays free of the persona
// capability. The chat must belong to the trusted current Project.
func (c *Chats) SetPersona(scope Scope, chatID, personaID string) error {
	if strings.TrimSpace(scope.ProjectID) == "" {
		return ErrInvalidScope
	}
	chat, err := c.store.ChatByID(scope.ProjectID, chatID)
	if err != nil {
		return err
	}
	if chat.ProjectID != scope.ProjectID {
		return ErrProjectScope
	}
	return c.store.SetChatPersona(chatID, strings.TrimSpace(personaID))
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// MemoryChatStore is an in-memory ChatStore (and AttachmentStore) for unit tests.
type MemoryChatStore struct {
	mu          sync.Mutex
	chats       map[string]Chat
	turns       map[string][]Turn
	attachments map[string]Attachment
}

// NewMemoryChatStore returns an empty in-memory ChatStore.
func NewMemoryChatStore() *MemoryChatStore {
	return &MemoryChatStore{chats: map[string]Chat{}, turns: map[string][]Turn{}, attachments: map[string]Attachment{}}
}

func (s *MemoryChatStore) CreateChatAttachment(att Attachment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.attachments[att.ID]; exists {
		return ErrInvalid
	}
	s.attachments[att.ID] = att
	return nil
}

func (s *MemoryChatStore) ChatAttachmentsByChat(chatID string) ([]Attachment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Attachment
	for _, a := range s.attachments {
		if a.ChatID == chatID {
			out = append(out, a)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (s *MemoryChatStore) ChatAttachmentByID(projectID, id string) (Attachment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	a, ok := s.attachments[id]
	if !ok || a.ProjectID != projectID {
		return Attachment{}, ErrNotFound
	}
	return a, nil
}

func (s *MemoryChatStore) DeleteChatAttachment(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.attachments, id)
	return nil
}

func (s *MemoryChatStore) CreateChat(chat Chat) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.chats[chat.ID]; exists {
		return ErrInvalid
	}
	s.chats[chat.ID] = chat
	return nil
}

func (s *MemoryChatStore) ChatByID(projectID, id string) (Chat, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	chat, ok := s.chats[id]
	if !ok || chat.ProjectID != projectID {
		return Chat{}, ErrNotFound
	}
	return chat, nil
}

func (s *MemoryChatStore) ChatsByProject(projectID, resourceID string) ([]Chat, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var chats []Chat
	for _, chat := range s.chats {
		if chat.ProjectID != projectID {
			continue
		}
		if resourceID != "" && chat.ResourceID != resourceID {
			continue
		}
		chats = append(chats, chat)
	}
	return chats, nil
}

func (s *MemoryChatStore) AppendTurn(turn Turn) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.chats[turn.ChatID]; !ok {
		return ErrNotFound
	}
	s.turns[turn.ChatID] = append(s.turns[turn.ChatID], turn)
	return nil
}

func (s *MemoryChatStore) TurnsByChat(chatID string) ([]Turn, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Turn(nil), s.turns[chatID]...), nil
}

func (s *MemoryChatStore) TouchChat(chatID string, at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	chat, ok := s.chats[chatID]
	if !ok {
		return ErrNotFound
	}
	chat.UpdatedAt = at
	s.chats[chatID] = chat
	return nil
}

func (s *MemoryChatStore) SetChatPersona(chatID, personaID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	chat, ok := s.chats[chatID]
	if !ok {
		return ErrNotFound
	}
	chat.PersonaID = personaID
	s.chats[chatID] = chat
	return nil
}
```
