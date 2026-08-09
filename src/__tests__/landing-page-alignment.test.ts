import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('operational entry route', () => {
  const routes = fs.readFileSync('src/routes.tsx', 'utf8');

  it('sends the public root straight to staff sign-in without loading a landing page', () => {
    expect(routes).toContain('<Route path="/" element={<Navigate to="/login" replace />} />');
    expect(routes).not.toContain('LandingPage');
  });
});
