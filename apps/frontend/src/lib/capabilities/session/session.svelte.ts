import {
  PROJECT_OVERVIEW,
  type Session,
  type SessionId,
  type SessionOptions,
  type SessionRuntime,
  type ResourceRef,
} from "$lib/capabilities/session/types";

/**
 * The session runtime — a singleton, because the tab strip, the context panel,
 * and the work surface all read the same list and the same active id.
 *
 * A module-level singleton is safe here *only because the app runs with
 * `ssr = false`* (see routes/+layout.ts). Under SSR, module state is shared
 * across every request on the server, so one user's open tabs would leak into
 * another's. If SSR is ever enabled this must move into a per-request context.
 *
 * `.svelte.ts` rather than `.ts` so `$state` is available. The fields are
 * `$state` and the public surface is getters: reassigning an exported `let`
 * does not propagate across a module boundary, but reading through a getter
 * does.
 */

let counter = 0;
const nextId = (): SessionId => `session-${++counter}`;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

class Sessions implements SessionRuntime {
  #sessions = $state<Session[]>([]);
  #activeId = $state<SessionId>("");

  constructor() {
    const overview: Session = {
      id: nextId(),
      resource: PROJECT_OVERVIEW,
      permanent: true,
      options: {},
    };
    this.#sessions = [overview];
    this.#activeId = overview.id;
  }

  get sessions(): readonly Session[] {
    return this.#sessions;
  }

  get activeId(): SessionId {
    return this.#activeId;
  }

  get active(): Session {
    const session = this.#find(this.#activeId);
    if (!session) {
      // Unreachable unless the never-empty invariant has been broken, which
      // would mean a permanent session was removed.
      throw new Error(`Active session ${this.#activeId} is not in the session list.`);
    }
    return session;
  }

  open(resource: ResourceRef): Session {
    // Match on kind *and* id: ids are only unique within a kind.
    const existing = this.#sessions.find(
      (session) => session.resource.kind === resource.kind && session.resource.id === resource.id
    );
    if (existing) {
      this.#activeId = existing.id;
      return existing;
    }

    const session: Session = {
      id: nextId(),
      resource,
      permanent: false,
      options: {},
    };
    this.#sessions.push(session);
    this.#activeId = session.id;
    return session;
  }

  close(id: SessionId): void {
    const index = this.#sessions.findIndex((session) => session.id === id);
    if (index === -1) throw new Error(`Cannot close unknown session ${id}.`);
    if (this.#sessions[index].permanent) {
      throw new Error(`Session ${id} is permanent and cannot be closed.`);
    }

    const wasActive = this.#activeId === id;
    this.#sessions.splice(index, 1);
    if (!wasActive) return;

    // Right, then left. After the splice the element now *at* `index` is the
    // one that was to the right. A permanent session always survives, so this
    // cannot fall through to nothing.
    const next = this.#sessions[index] ?? this.#sessions[index - 1];
    this.#activeId = next.id;
  }

  activate(id: SessionId): void {
    if (!this.#find(id)) throw new Error(`Cannot activate unknown session ${id}.`);
    this.#activeId = id;
  }

  reorder(id: SessionId, index: number): void {
    const from = this.#sessions.findIndex((session) => session.id === id);
    if (from === -1) throw new Error(`Cannot reorder unknown session ${id}.`);
    if (this.#sessions[from].permanent) {
      throw new Error(`Session ${id} is permanent and cannot be reordered.`);
    }

    // `index` is a position among transient sessions, so it is offset past the
    // permanent prefix. Clamping rather than throwing: a drag that overshoots
    // the ends is a normal gesture, not a caller error.
    const offset = this.#sessions.filter((session) => session.permanent).length;
    const to = offset + clamp(index, 0, this.#sessions.length - offset - 1);

    const [session] = this.#sessions.splice(from, 1);
    this.#sessions.splice(to, 0, session);
  }

  update(id: SessionId, patch: Partial<SessionOptions>): void {
    const session = this.#find(id);
    if (!session) throw new Error(`Cannot update unknown session ${id}.`);
    session.options = { ...session.options, ...patch };
  }

  #find(id: SessionId): Session | undefined {
    return this.#sessions.find((session) => session.id === id);
  }
}

export const sessions: SessionRuntime = new Sessions();
