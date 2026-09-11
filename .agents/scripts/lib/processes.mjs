import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

const cacheCommand = /(?:\/vite\/|vite\.js|\/vitest\/|vitest\.mjs|svelte-kit|svelte-check|@playwright\/test|\/playwright\/)/u;

export function processVisibility(processDirectory = '/proc') {
  if (process.platform !== 'linux') return 'unsupported';
  try {
    const init = readFileSync(join(processDirectory, '1/cmdline'), 'utf8');
    return /codex-linux-sandbox|bwrap|bubblewrap/u.test(init) ? 'sandbox-limited' : 'visible-linux-processes';
  } catch { return 'unreadable'; }
}

/** Read only process paths/arguments, never process environments. Linux best effort. */
export function cacheProcesses(app, processDirectory = '/proc') {
  if (process.platform !== 'linux') return null;
  const found = [];
  const canonical = realpathSync(app);
  for (const pid of readdirSync(processDirectory).filter((name) => /^\d+$/u.test(name))) {
    try {
      const directory = join(processDirectory, pid);
      if (realpathSync(join(directory, 'cwd')) !== canonical) continue;
      const command = readFileSync(join(directory, 'cmdline'), 'utf8').replaceAll('\0', ' ').trim();
      const match = command.match(cacheCommand);
      if (match) {
        const port = command.match(/--port(?:=|\s+)(\d+)/u)?.[1];
        found.push({ pid: Number(pid), tool: match[0].replaceAll('/', ''), ...(port ? { port: Number(port) } : {}) });
      }
    } catch { /* A process can exit, or belong to an unreadable user, during inspection. */ }
  }
  return found;
}

export function assertNoCacheProcesses(app) {
  const visibility = processVisibility();
  if (visibility !== 'visible-linux-processes') {
    throw new Error(`Process visibility is ${visibility}; an empty list cannot prove this worktree is idle. Request scoped process-inspection permission before using this helper. No process was started or stopped.`);
  }
  const found = cacheProcesses(app);
  if (found.length) {
    throw new Error(`This worktree has active cache users (PID ${found.map((item) => item.pid).join(', ')}). Stop only your own server or use another worktree; no process was stopped.`);
  }
}

export function portOf(value) {
  if (!/^\d+$/u.test(String(value))) throw new Error('Choose an explicit numeric port (1024–65535).');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Choose an explicit numeric port (1024–65535).');
  }
  return port;
}

export async function assertFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error) => reject(new Error(`Port ${port} is unavailable (${error.code}); choose your own unused port.`)));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(resolve));
  });
}
