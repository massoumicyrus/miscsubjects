import { describe, expect, it } from 'vitest';
import { releaseExpiredLeases } from './work_object.js';

describe('work lease expiry', () => {
  it('compares absolute instants instead of lexically comparing mixed ISO offsets', async () => {
    const prepared = [];
    const env = {
      DB: {
        prepare(sql) {
          prepared.push(sql);
          return {
            bind() { return this; },
            async all() { return { results: [] }; },
          };
        },
      },
    };

    await releaseExpiredLeases(env);

    expect(prepared).toHaveLength(1);
    expect(prepared[0]).toContain('unixepoch(lease_expires_at)<=unixepoch(?)');
    expect(prepared[0]).not.toMatch(/lease_expires_at\s*<=\s*\?/);
  });
});
