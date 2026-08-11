// Agent -> resource adapter for "Create with AI".
//
// Creating a resource with a prompt spawns an agent Action scoped to the new
// document, so the resource handler imports neither agent nor persona.
package wiring

import (
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
)

// resourceGenerator adapts the agent Action runner to the resource handler's
// ResourceGenerator port: "Create with AI" creates a resource, then this kicks
// off an Action (scoped to the new document) that populates it. It resolves the
// requester's default Persona, so the resource handler imports neither agent nor
// persona.
type resourceGenerator struct {
	workflows *agent.Workflows
	personas  *persona.Personas
}

func (g resourceGenerator) Generate(projectID, requesterID, documentID, prompt string) (string, error) {
	record, err := g.personas.DefaultForUser(persona.Scope{ProjectID: projectID}, requesterID)
	if err != nil {
		return "", err
	}
	selection := persona.Selection{ID: record.Persona.ID, Version: record.Version.Version}
	objective := "Write the requested content into document " + documentID +
		" using the document.edit tool: append well-structured blocks (a heading and paragraphs) as markdown. " +
		"Report only the confirmed change. Request: " + prompt
	task, err := g.workflows.CreateAction(agent.Scope{ProjectID: projectID}, requesterID, objective, nil, selection, documentID)
	if err != nil {
		return "", err
	}
	return task.ID, nil
}
