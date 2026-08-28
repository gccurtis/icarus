/**
 * What a generator does, as a plan rather than as writes.
 *
 * A generator that writes as it goes leaves half a directory behind when the
 * fourth file turns out to already exist. Everything is collected first,
 * checked, and then written — so a refusal changes nothing on disk, and
 * `--dry-run` is the same code path with the last step left off.
 *
 * Edits to existing files are part of the plan too. Three files that have to
 * agree — a table, its name in a list, its row type — is the whole reason a
 * generator exists rather than a template to copy.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

export class Plan {
  constructor(base) {
    this.base = base;
    this.creates = [];
    this.edits = [];
    this.removes = [];
    this.problems = [];
    this.notes = [];
  }

  at(path) {
    return relative(this.base, path).split(sep).join("/") || ".";
  }

  fail(where, message) {
    this.problems.push(`${where}  ${message}`);
    return this;
  }

  /** A new file. Refuses rather than overwrites: a generator never eats work. */
  create(path, contents) {
    if (existsSync(path)) return this.fail(this.at(path), "already exists");
    if (this.creates.some((entry) => entry.path === path)) {
      return this.fail(this.at(path), "would be written twice");
    }
    this.creates.push({ path, contents });
    return this;
  }

  /**
   * A change to a file that is already there, expressed as a function over its
   * text. Returning the text unchanged is how a generator says "already done".
   */
  edit(path, change) {
    if (!existsSync(path)) return this.fail(this.at(path), "is not there to edit");
    const before = readFileSync(path, "utf8");
    let after;
    try {
      after = change(before);
    } catch (error) {
      return this.fail(this.at(path), error.message);
    }
    if (after !== before) this.edits.push({ path, contents: after });
    return this;
  }

  /**
   * A file that has moved. Only ever the source of a `create` in the same plan —
   * a generator relocates its own output and deletes nothing else.
   */
  remove(path) {
    if (!existsSync(path)) return this;
    this.removes.push({ path });
    return this;
  }

  /** Something the author should look at, printed after the write. */
  note(message) {
    this.notes.push(message);
    return this;
  }

  get empty() {
    return this.creates.length === 0 && this.edits.length === 0 && this.removes.length === 0;
  }

  /** Writes everything, or reports and exits without touching anything. */
  run({ dryRun = false, what = "generated" } = {}) {
    if (this.problems.length > 0) {
      console.error(`${what}: ${this.problems.length} problem${this.problems.length === 1 ? "" : "s"}\n`);
      for (const problem of this.problems) console.error(`  ${problem}`);
      process.exit(1);
    }

    if (this.empty) {
      console.log(`${what}: nothing to do — everything it would write is already there`);
      return;
    }

    for (const { path, contents } of [...this.creates, ...this.edits]) {
      if (dryRun) continue;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }
    for (const { path } of this.removes) {
      if (!dryRun) rmSync(path);
    }

    const verb = dryRun ? "would write" : "wrote";
    const total = this.creates.length + this.edits.length + this.removes.length;
    console.log(`${what}: ${verb} ${total} file(s)\n`);
    for (const { path } of this.creates) console.log(`  +  ${this.at(path)}`);
    for (const { path } of this.edits) console.log(`  ~  ${this.at(path)}`);
    for (const { path } of this.removes) console.log(`  -  ${this.at(path)}`);
    if (this.notes.length === 0) return;
    console.log("");
    for (const note of this.notes) console.log(`  !  ${note}`);
  }
}

export const packageRootFrom = (url) => {
  const here = dirname(new URL(url).pathname);
  return resolve(here, "..", "..", "..");
};
