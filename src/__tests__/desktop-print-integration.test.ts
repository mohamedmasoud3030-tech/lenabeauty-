import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('desktop print integration', () => {
  const pos = fs.readFileSync('src/pages/PosInvoicesPage.tsx', 'utf8');

  it('wires desktop print bridge into POS print flow', () => {
    expect(pos).toContain('desktopRepository.printHtml');
    expect(pos).toContain('isDesktopShell()');
  });
});
