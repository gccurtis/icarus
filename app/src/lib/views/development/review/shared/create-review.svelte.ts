import { tick } from "svelte";
import type { Component } from "svelte";

import { doorCalls, forgetDoors, watchDoors, type DoorCall } from "$capabilities/read.svelte";
import { createTrace, type TraceRun } from "$components/development/trace.svelte";

/**
 * One review session: what is on the stage, what it turned out to be a function
 * of, and what it turned out to be made of.
 *
 * The three review pages differ only in which tree they enumerate, so the state
 * behind them is one object with the glob handed in. A constructor rather than a
 * module singleton, because two sessions in two tabs must not share a selection —
 * the same rule the model directory keeps.
 */

export type Entry = {
  /** `project/variables` — the path under the tree, and the id in the picker. */
  readonly id: string;
  /** `project` — the subject directory, used to group the picker. */
  readonly subject: string;
  /** `variables` — the file name. */
  readonly name: string;
  readonly load: () => Promise<{ default: Component }>;
};

/** What the picker is enumerating, and what the page calls it. */
export type ReviewKind = "context" | "inspector" | "workspace";

const entriesFrom = (modules: Record<string, () => Promise<unknown>>): Entry[] =>
  Object.entries(modules)
    .map(([path, load]) => {
      const parts = path.split("/lib/")[1].replace(/\.svelte$/, "").split("/");
      const rest = parts.slice(1);
      return {
        id: rest.join("/"),
        subject: rest.length > 1 ? rest[0] : "—",
        name: rest[rest.length - 1],
        load: load as Entry["load"]
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name));

export class Review {
  readonly kind: ReviewKind;
  readonly entries: Entry[];
  readonly run: TraceRun = createTrace();

  /** Which panel is on the stage. */
  selectedId = $state("");

  /**
   * The doors the last render called.
   *
   * A snapshot rather than a live read, because doors are called from inside
   * `$derived` and the log they write to is deliberately not reactive — writing
   * reactive state during a derivation is an unsafe mutation. This is refreshed
   * a tick after anything that could change what gets called.
   */
  doors = $state<DoorCall[]>([]);

  /** Bumped by the state editor, to make the snapshot re-run. */
  revision = $state(0);

  constructor(kind: ReviewKind, modules: Record<string, () => Promise<unknown>>) {
    this.kind = kind;
    this.entries = entriesFrom(modules);
    this.selectedId = this.entries[0]?.id ?? "";
    watchDoors(true);
  }

  get selected(): Entry | undefined {
    return this.entries.find((entry) => entry.id === this.selectedId);
  }

  /** The subjects, in picker order, each with its entries. */
  get grouped(): { subject: string; entries: Entry[] }[] {
    const subjects = [...new Set(this.entries.map((entry) => entry.subject))];
    return subjects.map((subject) => ({
      subject,
      entries: this.entries.filter((entry) => entry.subject === subject)
    }));
  }

  /**
   * Put a different panel on the stage.
   *
   * The tree and the door log are emptied here rather than left to unmount,
   * because a panel that fails to mount would otherwise leave the previous one
   * on the right-hand side and the reader would be looking at two things.
   */
  select(id: string): void {
    this.run.reset();
    forgetDoors();
    this.selectedId = id;
  }

  /** Re-read what the last render asked for. Runs after the DOM has settled. */
  async refresh(): Promise<void> {
    await tick();
    this.doors = doorCalls();
  }
}
