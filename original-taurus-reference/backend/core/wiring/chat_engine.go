// Agent/persona -> chat adapter.
//
// A chat turn is driven through the Ask engine (inline) or the Workflows engine
// (a durable task), under a resolved persona. Composing that here keeps the chat
// capability free of both agent and persona.
//
// A chat's attachments do not appear here. They are admitted to the knowledge
// lattice when they are uploaded (see attachmentLatticeWriter), so a turn
// retrieves them through the same search path as every other source. Inlining
// them into the prompt, as this adapter once did, put their content in front of
// the model as material no citation could refer to — and a grounded answer
// resting on it was rejected for having no citation.
package wiring

import (
	"context"

	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/chat"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// chatEngine adapts the Ask and Workflows services to the chat.ChatEngine port a
// chat turn drives: Ask answers inline; Plan and Action spawn a durable task the
// client polls. It is a private composition adapter, so the chat capability
// imports neither agent nor persona. A chat turn carries no Persona, so the
// adapter resolves the requester's default (General when unset) — the engine
// requires a valid selection.
type chatEngine struct {
	ask       *agent.Ask
	workflows *agent.Workflows
	personas  *persona.Personas
}

func (e chatEngine) Reply(scope chat.Scope, req chat.ChatReplyRequest) (chat.ChatReply, error) {
	// The chat id travels in the trusted scope, so a turn's tools reach only the
	// conversation the request named.
	agentScope := agent.Scope{ProjectID: scope.ProjectID, ChatID: req.ChatID, CallerID: req.RequesterID}
	// A conversation may pin a persona (by id; version 0 resolves to its current
	// version); otherwise the turn runs under the requester's default persona.
	var selection persona.Selection
	if req.PersonaID != "" {
		selection = persona.Selection{ID: req.PersonaID}
	} else {
		record, err := e.personas.DefaultForUser(persona.Scope{ProjectID: scope.ProjectID}, req.RequesterID)
		if err != nil {
			return chat.ChatReply{}, err
		}
		selection = persona.Selection{ID: record.Persona.ID, Version: record.Version.Version}
	}
	// A chat pinned to a resource (its ResourceID) scopes the tasks its Plan and
	// Action turns spawn to that document, so they surface under the document's
	// task filter.
	switch req.Mode {
	case chat.ModePlan:
		task, err := e.workflows.CreatePlan(agentScope, req.RequesterID, req.Message, nil, selection, req.ResourceID)
		if err != nil {
			return chat.ChatReply{}, err
		}
		return chat.ChatReply{TaskID: task.ID}, nil
	case chat.ModeAction:
		task, err := e.workflows.CreateAction(agentScope, req.RequesterID, req.Message, nil, selection, req.ResourceID)
		if err != nil {
			return chat.ChatReply{}, err
		}
		return chat.ChatReply{TaskID: task.ID}, nil
	default:
		resp, err := e.ask.Run(context.Background(), agentScope, agent.AskRequest{
			Prompt: req.Message, Persona: selection, IncludeWeb: req.IncludeWeb,
		})
		if err != nil {
			return chat.ChatReply{}, err
		}
		return chat.ChatReply{Body: resp.Answer, Usage: chatUsage(resp.Usage)}, nil
	}
}

// chatUsage sums an Ask's per-phase token counts into the chat turn's single
// usage block, so a live run surfaces the real cost of the answer.
func chatUsage(u agent.Usage) chat.Usage {
	return chat.Usage{
		PromptTokens: u.Planning.PromptTokens + u.Retrieval.PromptTokens + u.Answer.PromptTokens,
		TotalTokens:  u.Planning.TotalTokens + u.Retrieval.TotalTokens + u.Answer.TotalTokens,
	}
}
