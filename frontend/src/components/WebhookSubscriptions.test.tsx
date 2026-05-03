import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WebhookSubscriptions from './WebhookSubscriptions';

describe('WebhookSubscriptions', () => {
  const subs = [
    { id: 1, url: 'http://hook1', events: ['metric.alert'], enabled: true, filters: { metric: 'passRate' }, secret: 's1' },
  ];

  it('renders subscriptions list', () => {
    render(<WebhookSubscriptions isDark={false} subscriptions={subs} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('http://hook1')).toBeInTheDocument();
  });

  it('shows add form when clicking add', () => {
    render(<WebhookSubscriptions isDark={false} subscriptions={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText(/webhooks.add/i));
    expect(screen.getByPlaceholderText('URL')).toBeInTheDocument();
  });

  it('calls onDelete when clicking delete', () => {
    const onDelete = vi.fn();
    render(<WebhookSubscriptions isDark={false} subscriptions={subs} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
