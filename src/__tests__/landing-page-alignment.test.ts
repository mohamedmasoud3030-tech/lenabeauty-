import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('landing page product alignment', () => {
  const landing = fs.readFileSync('src/pages/LandingPage.tsx', 'utf8');

  it('mentions booking, portal and desktop value', () => {
    expect(landing).toContain('Client Portal');
    expect(landing).toContain('Desktop-Ready');
    expect(landing).toContain('Book online');
  });
});
