import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopShellBanner } from '../shared/components/DesktopShellBanner';
import '../i18n';

describe('DesktopShellBanner', () => {
  it('renders outside tauri shell', () => {
    render(<DesktopShellBanner />);
    expect(screen.getByText(/Desktop shell ready/i)).toBeTruthy();
  });
});
