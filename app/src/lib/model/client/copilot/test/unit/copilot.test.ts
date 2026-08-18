import assert from "node:assert/strict";
import { test } from "vitest";
import type { Selector } from "$shared/types/resource-set-expression";
import { createConfiguration } from "$model/client/configuration";
import { createCopilot } from "$model/client/copilot";
import type { Attachment, CopilotModel } from "$model/client/copilot";
import { createResourceRuntimes } from "$model/client/resource-runtimes";
import { createWorkbench } from "$model/client/workbench";

/**
 * What the copilot guarantees.
 *
 * Two properties carry most of it: a selector is in one list, the other, or
 * neither; and scope survives a send where attachments do not.
 */
const copilot = (): CopilotModel =>
  createCopilot(
    createWorkbench(
      createResourceRuntimes(
        createConfiguration({ revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 } } })
      )
    )
  );

const project: Selector = { kind: "project" };
const document: Selector = { kind: "resource", ref: { kind: "document", id: "d1" } };
const part: Selector = {
  kind: "part",
  ref: { kind: "document", id: "d1" },
  scopePath: "rows/#r1",
  label: "a paragraph"
};
const web: Selector = { kind: "web" };

const file: Attachment = { kind: "resource", ref: { kind: "external::text", id: "f1" } };
const link = (url: string, ok = true): Attachment => ({ kind: "link", url, triedAt: 0, ok });

// -------------------------------------------------------------- composing

test("a fresh copilot is empty and asks", () => {
  const model = copilot();

  assert.equal(model.mode, "ask");
  assert.deepEqual(model.destination, { kind: "new" });
  assert.equal(model.draft, "");
  assert.deepEqual(model.scope, { include: [], exclude: [] });
  assert.deepEqual(model.attachments, []);
});

test("an empty scope means nothing, not everything", () => {
  // A default that silently meant "the whole project" is how a scope somebody
  // meant to narrow leaks the lot.
  assert.deepEqual(copilot().scope.include, []);
});

test("addressing keeps the draft, the scope and the attachments", () => {
  // Changing where a message goes is redirecting it, not starting a new one.
  const model = copilot();
  model.write("half a thought");
  model.include(document);
  model.attach(file);

  model.address({ kind: "persona-thread", id: "t1" });

  assert.equal(model.draft, "half a thought");
  assert.deepEqual(model.scope.include, [document]);
  assert.deepEqual(model.attachments, [file]);
});

test("mode is global and survives everything", () => {
  const model = copilot();
  model.setMode("act");

  model.address({ kind: "agent-task", id: "a1" });
  model.sent({ kind: "agent-task", id: "a1" });

  assert.equal(model.mode, "act");
});

// ------------------------------------------------------------------ scope

test("a selector is in include, in exclude, or in neither", () => {
  const model = copilot();

  model.include(document);
  assert.deepEqual(model.scope.include, [document]);
  assert.deepEqual(model.scope.exclude, []);

  model.exclude(document);
  assert.deepEqual(model.scope.include, []);
  assert.deepEqual(model.scope.exclude, [document]);

  model.include(document);
  assert.deepEqual(model.scope.include, [document]);
  assert.deepEqual(model.scope.exclude, []);
});

test("dropping is not the same as excluding", () => {
  // Excluding states that something must not be used; dropping leaves it
  // unmentioned. Those differ the moment a broader selector is also present.
  const model = copilot();
  model.include(project);
  model.exclude(document);

  model.dropSelector(document);

  assert.deepEqual(model.scope.exclude, []);
  assert.deepEqual(model.scope.include, [project]);
});

test("dropping something that is in neither list is a no-op", () => {
  const model = copilot();
  model.include(project);

  assert.doesNotThrow(() => model.dropSelector(document));
  assert.deepEqual(model.scope.include, [project]);
});

test("every write normalizes", () => {
  // One set, one representation — otherwise two scopes that mean the same thing
  // compare unequal.
  const model = copilot();

  model.include(document);
  model.include(project);

  assert.deepEqual(model.scope.include, [project]);
});

test("part and web survive a project include", () => {
  // They are different mechanisms, not narrower statements of membership.
  const model = copilot();

  model.include(part);
  model.include(web);
  model.include(project);

  assert.equal(model.scope.include.length, 3);
});

test("a part is identified by its path, not its label", () => {
  // Otherwise dropSelector could not find the chip the user is clicking the
  // moment anything regenerated the label.
  const model = copilot();
  model.include(part);

  model.dropSelector({ ...part, label: "something else" });

  assert.deepEqual(model.scope.include, []);
});

test("clearScope says nothing rather than everything", () => {
  const model = copilot();
  model.include(project);

  model.clearScope();

  assert.deepEqual(model.scope, { include: [], exclude: [] });
});

// ------------------------------------------------------------ attachments

test("attaching the same thing twice is one attachment", () => {
  const model = copilot();

  model.attach(file);
  model.attach(file);

  assert.equal(model.attachments.length, 1);
});

test("a retried link replaces its chip rather than appending one", () => {
  // The second attempt may have succeeded where the first failed, and the newer
  // result is the true one.
  const model = copilot();
  model.attach(link("https://example.com", false));

  model.attach(link("https://example.com", true));

  assert.equal(model.attachments.length, 1);
  assert.equal((model.attachments[0] as { ok: boolean }).ok, true);
});

test("a link and a resource of the same shape do not collide", () => {
  // ResourceRef carries an open `kind`, so an unwrapped union would make a
  // resource of kind "link" indistinguishable from a fetched URL.
  const model = copilot();

  model.attach(link("https://example.com"));
  model.attach({ kind: "resource", ref: { kind: "link", id: "https://example.com" } });

  assert.equal(model.attachments.length, 2);
});

test("detaching matches by identity rather than by object", () => {
  const model = copilot();
  model.attach(file);

  model.detach({ kind: "resource", ref: { kind: "external::text", id: "f1" } });

  assert.deepEqual(model.attachments, []);
});

test("detaching something that is not there is a no-op", () => {
  const model = copilot();

  assert.doesNotThrow(() => model.detach(file));
});

// --------------------------------------------------------------- sending

test("blocked names the reason rather than answering yes or no", () => {
  // "type something" and "choose who answers" are different instructions.
  const model = copilot();

  assert.equal(model.blocked, "empty-draft");

  model.write("   ");
  assert.equal(model.blocked, "empty-draft");

  model.write("a question");
  assert.equal(model.blocked, "no-persona");

  model.selectPersona("p1");
  assert.equal(model.blocked, undefined);
});

test("an existing thread needs no persona", () => {
  const model = copilot();
  model.write("a follow-up");
  model.address({ kind: "persona-thread", id: "t1" });

  assert.equal(model.blocked, undefined);
});

test("neither scope nor attachments can block a message", () => {
  const model = copilot();
  model.write("a question");
  model.address({ kind: "agent-task", id: "a1" });

  assert.equal(model.blocked, undefined);
});

test("sending clears the draft and the attachments, and keeps the scope", () => {
  // Attachments are written onto the message; scope is a standing decision about
  // what the next one may draw on.
  const model = copilot();
  model.write("a question");
  model.selectPersona("p1");
  model.include(document);
  model.attach(file);

  model.sent({ kind: "persona-thread", id: "t1" });

  assert.equal(model.draft, "");
  assert.deepEqual(model.attachments, []);
  assert.deepEqual(model.scope.include, [document]);
  assert.equal(model.personaId, "p1");
});

test("sending into a new conversation addresses the thread it became", () => {
  // Staying on `new` would point the next message at a second new conversation
  // rather than continuing the one just started.
  const model = copilot();
  model.write("a question");
  model.selectPersona("p1");

  model.sent({ kind: "persona-thread", id: "t1" });

  assert.deepEqual(model.destination, { kind: "persona-thread", id: "t1" });
});

test("the model never sends, so a refusal is simply the absence of a call", () => {
  // The dock calls the mutation and reports the result. A refused mutation leaves
  // the draft in the composer, because `sent` was never called.
  const model = copilot();
  model.write("a question");
  model.selectPersona("p1");

  assert.equal(model.draft, "a question");
  assert.equal(typeof (model as unknown as { send?: unknown }).send, "undefined");
});

// ----------------------------------------------------------------- focus

test("focus counts up, so two requests are two focuses", () => {
  // A boolean would have to be reset by whoever consumed it, which means the
  // model holding a flag about a DOM operation it cannot observe.
  const model = copilot();

  assert.equal(model.focusRequests, 0);
  model.focus();
  model.focus();
  assert.equal(model.focusRequests, 2);
});

// -------------------------------------------------------------- isolation

test("two copilots share nothing", () => {
  const a = copilot();
  const b = copilot();

  a.write("only in a");
  a.include(project);
  a.attach(file);

  assert.equal(b.draft, "");
  assert.deepEqual(b.scope.include, []);
  assert.deepEqual(b.attachments, []);
});
