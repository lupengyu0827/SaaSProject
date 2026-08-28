import { describe, expect, it } from 'vitest';

import { HealthController } from '../src/health/health.controller.js';

describe('HealthController', () => {
  it('reports a healthy core', () => {
    expect(new HealthController().getHealth()).toMatchObject({
      service: 'core',
      status: 'ok',
    });
  });
});
