import { describe, expect, it } from 'vitest';
import { buildBackendUrl } from '../client/src/lib/backend.js';

describe('backend URL helpers', () => {
  it('returns relative paths when no backend origin is configured', () => {
    expect(buildBackendUrl('/api/bootstrap', '')).toBe('/api/bootstrap');
  });

  it('builds absolute backend URLs when a backend origin is configured', () => {
    expect(buildBackendUrl('/api/bootstrap', 'https://market-api.onrender.com')).toBe(
      'https://market-api.onrender.com/api/bootstrap',
    );
  });
});
