import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, RoleTag } from './status-badge';

describe('StatusBadge', () => {
  it.each([
    ['checked_out', 'Checked Out'],
    ['pending', 'Pending'],
    ['rejected', 'Rejected'],
    ['returned', 'Returned & Verified'],
  ])('renders the human label for status "%s"', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('falls back to the raw status string for an unrecognized value', () => {
    render(<StatusBadge status="some_future_status" />);
    expect(screen.getByText('some_future_status')).toBeInTheDocument();
  });
});

describe('RoleTag', () => {
  it('labels a secretary requester as "Secretary"', () => {
    render(<RoleTag role="secretary" />);
    expect(screen.getByText('Secretary')).toBeInTheDocument();
  });

  it('labels anything else as "Student"', () => {
    render(<RoleTag role="student" />);
    expect(screen.getByText('Student')).toBeInTheDocument();
  });
});
