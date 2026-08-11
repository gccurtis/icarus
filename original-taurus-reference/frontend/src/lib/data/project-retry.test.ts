import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withProject } from './project-retry';

// mock the api module
vi.mock('./api', () => ({
  isApiError: (e: unknown) => typeof e === 'object' && e !== null && 'status' in e && 'message' in e,
  api: vi.fn()
}));

// mock the projects module
vi.mock('./projects', () => ({
  openProject: vi.fn()
}));

import { openProject } from './projects';

describe('withProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withProject('proj-1', fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(openProject).not.toHaveBeenCalled();
  });

  it('retries once on 409 error', async () => {
    const error409 = { status: 409, message: 'select a project first' };
    const fn = vi.fn()
      .mockRejectedValueOnce(error409)
      .mockResolvedValueOnce('recovered');

    const result = await withProject('proj-2', fn);
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(openProject).toHaveBeenCalledWith('proj-2');
    expect(openProject).toHaveBeenCalledTimes(1);
  });

  it('propagates non-409 errors without retrying', async () => {
    const error500 = { status: 500, message: 'internal error' };
    const fn = vi.fn().mockRejectedValue(error500);

    await expect(withProject('proj-3', fn)).rejects.toEqual(error500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(openProject).not.toHaveBeenCalled();
  });

  it('propagates 409 if the second attempt also fails', async () => {
    const error409 = { status: 409, message: 'still stale' };
    const fn = vi.fn().mockRejectedValue(error409);

    await expect(withProject('proj-4', fn)).rejects.toEqual(error409);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(openProject).toHaveBeenCalledTimes(1);
  });

  it('propagates non-ApiError exceptions without retrying', async () => {
    const error = new Error('network failure');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withProject('proj-5', fn)).rejects.toThrow('network failure');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(openProject).not.toHaveBeenCalled();
  });

  it('does not retry on other 4xx errors', async () => {
    const error404 = { status: 404, message: 'not found' };
    const fn = vi.fn().mockRejectedValue(error404);

    await expect(withProject('proj-6', fn)).rejects.toEqual(error404);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(openProject).not.toHaveBeenCalled();
  });
});
