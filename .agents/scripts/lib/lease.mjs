import { mkdirSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export function readLease(directory) {
  try {
    return JSON.parse(readFileSync(join(directory, '.agents/runtime/worktree.lock/owner.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    return { error: 'Lease metadata is unreadable; inspect it manually.' };
  }
}

/** No automatic stale-lock stealing: a child may outlive its original parent. */
export function acquireLease(directory, label, details = {}) {
  const runtime = join(directory, '.agents/runtime');
  const lock = join(runtime, 'worktree.lock');
  mkdirSync(runtime, { recursive: true });
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = readLease(directory);
    throw new Error(`Worktree lease is already held (${owner?.label ?? 'unknown owner'}, PID ${owner?.pid ?? 'unknown'}). Inspect status; do not run cache-touching commands concurrently or steal the lease.`);
  }
  const token = randomUUID();
  const file = join(lock, 'owner.json');
  try {
    writeFileSync(file, JSON.stringify({ ...details, token, label, pid: process.pid, started: new Date().toISOString() }, null, 2), { flag: 'wx' });
  } catch (error) {
    rmdirSync(lock);
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    if (readLease(directory)?.token !== token) throw new Error('Lease ownership changed; refusing to remove it.');
    unlinkSync(file);
    rmdirSync(lock);
    released = true;
  };
}
