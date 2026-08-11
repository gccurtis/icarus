// Background trash purge.
//
// Documents deleted into the trash become eligible for permanent removal once
// they are older than the configured retention. Reclaiming them is maintenance:
// it must not sit on the boot path, and it must keep happening for as long as
// the process runs.
package wiring

import (
	"context"
	"log"
	"time"
)

// trashPurgeInterval is how often stale trash is reclaimed. Retention is measured
// in days, so an hourly sweep is far finer than it needs to be while keeping the
// work negligible.
const trashPurgeInterval = time.Hour

// stalePurger is the one operation the purge loop needs from the document
// capability, declared here so the loop is testable without a document service.
type stalePurger interface {
	PurgeStale() error
}

// runTrashPurge reclaims documents whose trash retention has elapsed: once at
// startup, then on every tick until ctx is cancelled.
//
// This used to be a single synchronous call in Run, which had two problems: it
// delayed readiness by however long the sweep took, and it meant a long-lived
// process purged exactly once — trash accumulated for the rest of its life. A
// failed sweep is logged, never fatal; the next tick tries again.
func runTrashPurge(ctx context.Context, p stalePurger, interval time.Duration) {
	purge := func() {
		if err := p.PurgeStale(); err != nil {
			log.Printf("documents: purge stale: %v", err)
		}
	}
	purge()

	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			purge()
		}
	}
}
