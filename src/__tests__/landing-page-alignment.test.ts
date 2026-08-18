import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('operational entry route', () => {
  const routes = fs.readFileSync('src/routes.tsx', 'utf8');

  it('sends the public root straight to staff sign-in without loading a landing page', () => {
    expect(routes).toContain('<Route path="/" element={<Navigate to="/login" replace />} />');
    expect(routes).not.toContain('LandingPage');
  });

  it('no longer ships a marketing landing page in the source tree', () => {
    // The unrouted LandingPage carried invented 5-star testimonials from
    // fictional people and advertised deny-by-default capabilities (public
    // booking, client portal, offline desktop). Keeping unreachable fake
    // social proof in the shipped source is a standing risk of publishing it,
    // so the file was removed rather than merely left unrouted.
    expect(fs.existsSync('src/pages/LandingPage.tsx')).toBe(false);
  });
});
