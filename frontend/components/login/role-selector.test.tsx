import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleSelector, LOGIN_ROLE_TABS } from './role-selector';

describe('RoleSelector', () => {
  it('renders exactly the four role tabs, in order', () => {
    render(<RoleSelector value="student" onChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons.map((b) => b.textContent)).toEqual(
      LOGIN_ROLE_TABS.map((r) => r.label),
    );
  });

  it('marks only the active tab as pressed', () => {
    render(<RoleSelector value="secretary" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Secretary' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Student' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onChange with the clicked tab\'s id', async () => {
    const onChange = vi.fn();
    render(<RoleSelector value="student" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Caretaker' }));
    expect(onChange).toHaveBeenCalledWith('caretaker');
  });

  it('is a dumb tab strip - clicking never fires onChange for the already-active tab\'s own value only', async () => {
    const onChange = vi.fn();
    render(<RoleSelector value="admin" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(onChange).toHaveBeenCalledWith('admin');
  });
});
