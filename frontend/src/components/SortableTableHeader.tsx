import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export interface ColumnDef {
  key: string;
  label: string;
}

interface SortableHeaderCellProps {
  column: ColumnDef;
  tableId: string;
}

function SortableHeaderCell({ column, tableId }: SortableHeaderCellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.key,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
    whiteSpace: 'nowrap',
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      {...attributes}
      role="columnheader"
      aria-describedby={`${tableId}-drag-hint`}
      {...listeners}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <GripVertical size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
        {column.label}
      </span>
    </th>
  );
}

interface SortableTableHeaderProps {
  columns: ColumnDef[];
  columnOrder: string[];
  onReorder: (order: string[]) => void;
  tableId: string;
}

export default function SortableTableHeader({
  columns,
  columnOrder,
  onReorder,
  tableId,
}: SortableTableHeaderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedColumns = React.useMemo(() => {
    const map = new Map(columns.map((c) => [c.key, c]));
    return columnOrder.map((key) => map.get(key)).filter(Boolean) as ColumnDef[];
  }, [columns, columnOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));
      onReorder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

  return (
    <>
      <span id={`${tableId}-drag-hint`} style={{ display: 'none' }}>
        Glissez-déposez les colonnes pour réorganiser l'ordre d'affichage du tableau
      </span>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={columnOrder}
          strategy={horizontalListSortingStrategy}
        >
          <tr>
            {orderedColumns.map((column) => (
              <SortableHeaderCell key={column.key} column={column} tableId={tableId} />
            ))}
          </tr>
        </SortableContext>
      </DndContext>
    </>
  );
}
