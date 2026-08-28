#!/usr/bin/env node
/**
 * Renders components and reports what failed, as JSON on stdout.
 *
 * A separate process because SvelteKit's vite plugin overrides `root` with the
 * working directory — so pointing a server at a tree means *being* in it, and a
 * check cannot change the working directory of the run it is part of. The parent
 * spawns this with `cwd` set to the tree it means, which is the only way the
 * server renders the files the check is asking about rather than the ones beside
 * the script.
 *
 * Input is `{ paths, props }` on stdin, relative to the working directory.
 */
import { createServer } from "vite";

const read = async () => {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return JSON.parse(text);
};

const { paths, props } = await read();

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true }
});

const { render } = await server.ssrLoadModule("svelte/server");

const failures = [];
for (const path of paths) {
  try {
    const module = await server.ssrLoadModule(`/${path}`);
    if (typeof module.default !== "function") throw new Error("exports no component");
    const { body } = render(module.default, { props });
    if (!body || body.length === 0) throw new Error("rendered nothing");
  } catch (error) {
    failures.push({ path, message: error.message.split("\n")[0] });
  }
}

await server.close();
process.stdout.write(JSON.stringify(failures));
