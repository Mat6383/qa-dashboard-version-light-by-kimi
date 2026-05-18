/**
 * ================================================
 * SORTABLE KPI CARD — Wrapper drag & drop
 * ================================================
 * Option C "Pro Suite" — Enveloppe KPICard avec @dnd-kit/sortable.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import KPICard from './KPICard';
import type { KPICardProps } from './KPICard';

interface SortableKPICardProps extends KPICardProps {
  id: string;
  dragEnabled?: boolean;
}

export default function SortableKPICard({ id, dragEnabled = true, className = '', ...kpiProps }: SortableKPICardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !dragEnabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`sortable-kpi ${className}`}>
      {dragEnabled && (
        <div
          className="sortable-kpi__handle"
          {...attributes}
          {...listeners}
          role="button"
          aria-label="Déplacer ce widget"
          tabIndex={0}
        >
          <GripVertical size={16} />
        </div>
      )}
      <KPICard {...kpiProps} />
    </div>
  );
}
