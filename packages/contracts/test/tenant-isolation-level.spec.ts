import { describe, expect, it } from 'vitest';

import { TenantIsolationLevel } from '../src/index.js';

describe('TenantIsolationLevel', () => {
  it('keeps the three billable isolation levels stable', () => {
    expect(Object.values(TenantIsolationLevel)).toEqual(['logical', 'schema', 'physical']);
  });
});
