import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileDrawer from './MobileDrawer';

describe('MobileDrawer', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <MobileDrawer isOpen={false} onClose={vi.fn()} title="Settings">
        <p>Content</p>
      </MobileDrawer>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and children when open', () => {
    render(
      <MobileDrawer isOpen onClose={vi.fn()} title="Settings">
        <p data-testid="content">Content</p>
      </MobileDrawer>
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <MobileDrawer isOpen onClose={onClose} title="Settings">
        <p>Content</p>
      </MobileDrawer>
    );
    fireEvent.click(container.querySelector('.mobile-drawer-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer isOpen onClose={onClose} title="Settings">
        <p>Content</p>
      </MobileDrawer>
    );
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(onClose).toHaveBeenCalled();
  });
});
