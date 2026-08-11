package wiring

import (
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

// resourceToolSource adapts the resource.ToolSource to the agent.ResourceToolSource
// interface, bridging the two packages without either importing the other.
type resourceToolSource struct {
	resources *resource.Resources
}

func (rts resourceToolSource) ListTool(scope agent.ResourceScope) intelligence.ToolBinding {
	ts := resource.NewToolSource(rts.resources)
	return ts.ListTool(resource.ProjectScope{
		ProjectID: scope.ProjectID,
		CallerID:  scope.CallerID,
	})
}

func (rts resourceToolSource) ReadTool(scope agent.ResourceScope) intelligence.ToolBinding {
	ts := resource.NewToolSource(rts.resources)
	return ts.ReadTool(resource.ProjectScope{
		ProjectID: scope.ProjectID,
		CallerID:  scope.CallerID,
	})
}
