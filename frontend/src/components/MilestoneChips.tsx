/**
 * ================================================
 * MILESTONE CHIPS — Filtres contextuels inline
 * ================================================
 * Option C "Pro Suite" — Remplace le sélecteur de milestones
 * par des chips interactives avec suppression rapide.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React from 'react';
import { X, Plus, Filter } from 'lucide-react';
import type { Milestone } from '../types/api.types';

export type ChipVariant = 'preprod' | 'prod';

interface MilestoneChipsProps {
  milestones: Milestone[];
  selected: number[];
  onToggle: (id: number) => void;
  onAdd?: () => void;
  variant: ChipVariant;
  label?: string;
}

const variantStyles: Record<
  ChipVariant,
  { bg: string; color: string; border: string; hoverBg: string }
> = {
  preprod: {
    bg: 'rgba(59,130,246,0.1)',
    color: 'var(--text-info)',
    border: 'rgba(59,130,246,0.25)',
    hoverBg: 'rgba(59,130,246,0.2)',
  },
  prod: {
    bg: 'rgba(239,68,68,0.1)',
    color: 'var(--text-danger)',
    border: 'rgba(239,68,68,0.25)',
    hoverBg: 'rgba(239,68,68,0.2)',
  },
};

export default function MilestoneChips({
  milestones,
  selected,
  onToggle,
  onAdd,
  variant,
  label,
}: MilestoneChipsProps) {
  const styles = variantStyles[variant];
  const selectedMilestones = milestones.filter((m) => selected.includes(m.id));

  return (
    <div className="milestone-chips" role="group" aria-label={label || `Filtres ${variant}`}>
      {label && (
        <span className="milestone-chips__label">
          <Filter size={12} />
          {label}
        </span>
      )}
      {selectedMilestones.map((m) => (
        <button
          key={m.id}
          className="milestone-chips__chip"
          onClick={() => onToggle(m.id)}
          type="button"
          title={`Retirer ${m.name}`}
          style={{
            backgroundColor: styles.bg,
            color: styles.color,
            border: `1px solid ${styles.border}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = styles.hoverBg;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = styles.bg;
          }}
        >
          <span className="milestone-chips__name">{m.name}</span>
          <span className="milestone-chips__remove" aria-hidden="true">
            <X size={12} />
          </span>
        </button>
      ))}
      {onAdd && (
        <button
          className="milestone-chips__add"
          onClick={onAdd}
          type="button"
          title="Ajouter un filtre"
        >
          <Plus size={12} />
          <span>Ajouter</span>
        </button>
      )}
    </div>
  );
}
