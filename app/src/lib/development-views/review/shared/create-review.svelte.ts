import { tick } from "svelte";
import type { Component } from "svelte";

import { createTrace, type TraceRun } from "$development-components/trace.svelte";

/**
 * One review session: what is on the stage, what it turned out to be a function
 * of, and what it turned out to be made of.
 *
 * The three review pages differ only in which tree they enumerate, so the state
 * behind them is one object with the glob handed in. A constructor rather than a
 * module singleton, because two sessions in two tabs must not share a selection
 * or an override — the same rule the model directory keeps.
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

/** What a capability was asked and what it answered, for one render. */
export type RecordedRead = {
  readonly id: string;
  readonly value: unknown;
  /** Whether what came back was the reader's answer rather than the capability's. */
  readonly overridden: boolean;
};

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
   * What the last render asked for.
   *
   * A snapshot rather than a live read, because a read happens inside `$derived`
   * and the log it writes to is deliberately not reactive — writing reactive
   * state during a derivation is an unsafe mutation. This is refreshed a tick
   * after anything that could change what gets called.
   */
  reads = $state<RecordedRead[]>([]);

  /** Bumped by the state editor, to make the snapshot re-run. */
  revision = $state(0);

  #calls = new Map<string, RecordedRead>();
  #overrides = $state<Record<string, unknown>>({});

  constructor(kind: ReviewKind, modules: Record<string, () => Promise<unknown>>) {
    this.kind = kind;
    this.entries = entriesFrom(modules);
    this.selectedId = this.entries[0]?.id ?? "";
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

  get overriddenCount(): number {
    return this.reads.filter((read) => read.overridden).length;
  }

  /**
   * Record what a capability answered, and hand back the reader's answer where
   * there is one. This is the hook a panel's reads go through; nothing calls it
   * yet, because a real query is not intercepted the way the mock read was.
   */
  answer<T>(id: string, current: T): T {
    const override = this.#overrides[id];
    const overridden = override !== undefined;
    const value = overridden ? (override as T) : current;
    this.#calls.set(id, { id, value, overridden });
    return value;
  }

  /** Forget the last render's calls, before mounting a different panel. */
  forget(): void {
    this.#calls.clear();
  }

  /**
   * Put a different panel on the stage.
   *
   * The tree and the read log are emptied here rather than left to unmount,
   * because a panel that fails to mount would otherwise leave the previous one
   * on the right-hand side and the reader would be looking at two things.
   */
  select(id: string): void {
    this.run.reset();
    this.forget();
    this.selectedId = id;
  }

  /**
   * Put a different answer in front of a capability. An override is not an edit:
   * what the capability returns is never written to, so two panels reading the
   * same thing still agree with each other.
   */
  override(id: string, value: unknown): void {
    this.#overrides[id] = value;
  }

  clearOverride(id: string): void {
    delete this.#overrides[id];
  }

  clearOverrides(): void {
    for (const id of Object.keys(this.#overrides)) delete this.#overrides[id];
  }

  /** Re-read what the last render asked for. Runs after the DOM has settled. */
  async refresh(): Promise<void> {
    await tick();
    this.reads = [...this.#calls.values()];
  }
}
