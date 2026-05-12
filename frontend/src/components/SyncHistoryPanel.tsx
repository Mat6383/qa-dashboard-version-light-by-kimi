/**
 * ================================================
 * SYNC HISTORY PANEL — Tableau des 50 derniers runs
 * ================================================
 * Affiche l'historique des synchronisations GitLab → Testmo.
 * Basé sur @tanstack/react-table.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.1.0
 */

import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { RefreshCw, Clock } from 'lucide-react';
import { formatDate } from './SyncLogParts';

interface SyncHistoryRow {
  id: number;
  executed_at: string;
  project_name: string;
  iteration_name: string;
  mode: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  total_issues: number;
}

const columnHelper = createColumnHelper<SyncHistoryRow>();

const columns = [
  columnHelper.accessor('executed_at', {
    header: 'Date',
    cell: (info) => (
      <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        {formatDate(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('project_name', {
    header: 'Projet',
    cell: (info) => <strong>{info.getValue()}</strong>,
  }),
  columnHelper.accessor('iteration_name', {
    header: 'Itération',
  }),
  columnHelper.accessor('mode', {
    header: 'Mode',
    cell: (info) => (
      <span className={info.getValue() === 'execute' ? 'd6-mode-execute' : 'd6-mode-preview'}>
        {info.getValue() === 'execute' ? 'Exécution' : 'Aperçu'}
      </span>
    ),
  }),
  columnHelper.accessor('created', {
    header: 'Créés',
    meta: { align: 'center' },
    cell: (info) => (
      <span style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('updated', {
    header: 'MàJ',
    meta: { align: 'center' },
    cell: (info) => (
      <span style={{ textAlign: 'center', color: 'var(--color-primary)', fontWeight: 700 }}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('skipped', {
    header: 'Ignorés',
    meta: { align: 'center' },
    cell: (info) => (
      <span style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('errors', {
    header: 'Erreurs',
    meta: { align: 'center' },
    cell: (info) => {
      const val = info.getValue();
      return (
        <span style={{ textAlign: 'center', color: val > 0 ? 'var(--color-danger)' : 'inherit' }}>
          {val}
        </span>
      );
    },
  }),
  columnHelper.accessor('total_issues', {
    header: 'Total',
    meta: { align: 'center' },
    cell: (info) => <span style={{ textAlign: 'center' }}>{info.getValue()}</span>,
  }),
];

export default function SyncHistoryPanel({ history, onRefresh }) {
  const table = useReactTable({
    data: history,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="d6-section">
      <div className="d6-section-header">
        <Clock size={14} />
        Historique (50 derniers runs)
        <button
          className="d6-btn d6-btn-ghost"
          style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}
          onClick={onRefresh}
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {history.length === 0 ? (
        <div className="d6-section-body">
          <div className="d6-alert d6-alert-info">
            <Clock size={14} />
            Aucun historique disponible — lancez votre première synchronisation.
          </div>
        </div>
      ) : (
        <table className="d6-history-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ textAlign: (header.column.columnDef.meta as any)?.align || 'left' }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ textAlign: (cell.column.columnDef.meta as any)?.align || 'left' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
