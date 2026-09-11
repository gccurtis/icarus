import { spawn } from 'node:child_process';
import { openSync, writeSync, closeSync } from 'node:fs';

/** One foreground child; forward shutdown and wait for its actual exit. */
export function runCommand(command, args, { cwd, env = process.env, log } = {}) {
  return new Promise((resolve, reject) => {
    const destination = log ? openSync(log, 'wx') : undefined;
    let failure;
    const child = spawn(command, args, {
      cwd, env, stdio: log ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      detached: process.platform !== 'win32'
    });
    const forward = (signal) => {
      if (!child.pid) return;
      try {
        if (process.platform === 'win32') child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    };
    const interrupt = () => forward('SIGINT');
    const terminate = () => forward('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const cleanup = () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
      if (destination !== undefined) closeSync(destination);
    };
    if (destination !== undefined) {
      const capture = (stream) => (chunk) => {
        stream.write(chunk);
        try { writeSync(destination, chunk); }
        catch (error) { failure = error; forward('SIGTERM'); }
      };
      child.stdout.on('data', capture(process.stdout));
      child.stderr.on('data', capture(process.stderr));
    }
    child.once('error', (error) => { failure = error; });
    child.once('close', (code, signal) => {
      cleanup();
      if (failure) { reject(failure); return; }
      resolve({ code: code ?? (signal === 'SIGINT' ? 130 : 143), signal });
    });
  });
}
