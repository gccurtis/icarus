// Configuration loading and its translation into runtime values.
//
// The manifest is resolved and overlaid here, and the configured shapes are
// mapped onto the types the capabilities actually take — casts, routes,
// durations and the frozen agent policy — so Run reads as a boot sequence
// rather than a translation layer.
package wiring

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/intelligence"
	"github.com/gccurtis/taurus-omega/core/platform/config"
)

// promptCast turns a configured prompt-cast reference into an intelligence cast
// (the four semantic coordinates; the model is resolved via the reasoning table).
func promptCast(c config.PromptCast) intelligence.Cast {
	return intelligence.Cast{Purpose: c.Purpose, Strength: c.Strength, Speed: c.Speed, Cost: c.Cost}
}

// castRoutes maps configured casts onto intelligence routes.
func castRoutes(casts []config.Cast) []intelligence.Route {
	routes := make([]intelligence.Route, len(casts))
	for i, c := range casts {
		routes[i] = intelligence.Route{
			Cast:     intelligence.Cast{Purpose: c.Purpose, Strength: c.Strength, Speed: c.Speed, Cost: c.Cost},
			Provider: c.Provider,
			Model:    c.Model,
			Effort:   c.Effort,
		}
	}
	return routes
}

// loadConfig resolves and loads the configuration manifest. The path comes from
// TAURUS_OMEGA_CONFIG, falling back to defaultConfigPath. A missing file at the
// default path is not fatal — the built-in defaults are used — but a missing
// file at an explicitly requested path, or any parse error, is.
func loadConfig() config.Config {
	path := os.Getenv("TAURUS_OMEGA_CONFIG")
	explicit := path != ""
	if !explicit {
		path = defaultConfigPath
	}

	cfg, err := config.Load(path)
	if err != nil {
		if !explicit && errors.Is(err, os.ErrNotExist) {
			log.Printf("config: %s not found, using built-in defaults", path)
			return config.Default()
		}
		log.Fatalf("config: %v", err)
	}

	log.Printf("config: loaded %s", path)

	// Overlay an optional, gitignored local manifest (e.g. etc/config.local.yaml)
	// on top of the loaded one. This is where secrets such as provider API keys
	// live, so the committed template never carries a key. A missing local file
	// is fine — it just means no overrides.
	localPath := config.LocalPath(path)
	if _, statErr := os.Stat(localPath); statErr == nil {
		cfg, err = config.Overlay(cfg, localPath)
		if err != nil {
			log.Fatalf("config: %v", err)
		}
		log.Printf("config: overlaid %s", localPath)
	}

	return cfg
}

func parseDurationOrZero(s string) time.Duration {
	if s == "" {
		return 0
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return 0
	}
	return d
}

// configuredAgentPolicy translates deployment configuration into the frozen Agent
// Policy used by Ask, Plan, and Action workflows. Empty prompts and schemas fall
// back to the built-in defaults inside agent.Policy.effective().
func configuredAgentPolicy(cfg config.Agents) agent.Policy {
	return agent.Policy{
		Prompts: agent.Prompts{
			RetrievalPlan: cfg.Prompts.RetrievalPlan,
			Ask:           cfg.Prompts.Ask,
			Plan:          cfg.Prompts.Plan,
			Action:        cfg.Prompts.Action,
		},
		Schemas: agent.Schemas{
			RetrievalPlan: json.RawMessage(cfg.Schemas.RetrievalPlan),
			Ask:           json.RawMessage(cfg.Schemas.Ask),
			Plan:          json.RawMessage(cfg.Schemas.Plan),
			Action:        json.RawMessage(cfg.Schemas.Action),
		},
	}
}
