import { describe, expect, it } from 'vitest';

import { HealthController } from '../src/health/health.controller.js';

describe('HealthController', () => {
  it('reports a healthy gateway', () => {
    expect(new HealthController().getHealth()).toMatchObject({
      service: 'gateway',
      status: 'ok',
    });
  });
});
