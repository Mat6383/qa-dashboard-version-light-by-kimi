import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlertTemplates from './AlertTemplates';

describe('AlertTemplates', () => {
  it('renders 3 template sections', () => {
    render(<AlertTemplates isDark={false} templates={{}} onSave={vi.fn()} savePending={false} />);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(3);
  });

  it('updates local state on textarea change', () => {
    render(<AlertTemplates isDark={false} templates={{ emailTemplate: '' }} onSave={vi.fn()} savePending={false} />);
    const textarea = screen.getAllByRole('textbox')[0];
    fireEvent.change(textarea, { target: { value: 'Hello {{metric}}' } });
    expect(textarea).toHaveValue('Hello {{metric}}');
  });

  it('shows preview with replaced variables', () => {
    render(<AlertTemplates isDark={false} templates={{ emailTemplate: '{{metric}} = {{value}}%' }} onSave={vi.fn()} savePending={false} />);
    expect(screen.getByText(/passRate = 87.5%/)).toBeInTheDocument();
  });

  it('calls onSave with templates', () => {
    const onSave = vi.fn();
    render(<AlertTemplates isDark={false} templates={{ emailTemplate: 'Test' }} onSave={onSave} savePending={false} />);
    fireEvent.click(screen.getByRole('button', { name: /sauvegarder/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ emailTemplate: 'Test' }));
  });

  it('resets templates on reset click', () => {
    render(<AlertTemplates isDark={false} templates={{ emailTemplate: 'Test' }} onSave={vi.fn()} savePending={false} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    const textarea = screen.getAllByRole('textbox')[0];
    expect(textarea).toHaveValue('');
  });
});
