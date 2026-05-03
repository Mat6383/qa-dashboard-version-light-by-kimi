import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SortableTableHeader, { type ColumnDef } from './SortableTableHeader';

const COLUMNS: ColumnDef[] = [
  { key: 'iid', label: '#' },
  { key: 'title', label: 'Ticket' },
  { key: 'assignees', label: 'Assigné(s)' },
  { key: 'state', label: 'Statut' },
  { key: 'comments', label: 'Commentaires' },
];

describe('SortableTableHeader', () => {
  it('renders all column headers in given order', () => {
    const order = ['title', 'iid', 'comments', 'state', 'assignees'];
    render(
      <table>
        <thead>
          <SortableTableHeader
            columns={COLUMNS}
            columnOrder={order}
            onReorder={() => {}}
            tableId="test-table"
          />
        </thead>
      </table>
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(5);
    expect(headers[0]).toHaveTextContent('Ticket');
    expect(headers[1]).toHaveTextContent('#');
    expect(headers[2]).toHaveTextContent('Commentaires');
    expect(headers[3]).toHaveTextContent('Statut');
    expect(headers[4]).toHaveTextContent('Assigné(s)');
  });
});
