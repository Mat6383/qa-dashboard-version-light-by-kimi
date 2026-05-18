/**
 * ================================================
 * PREPROD SECTION — Dashboard4 Préproduction v4
 * ================================================
 * Refactored: extracted KPIWidget, StatusDistribution, CampaignGrid.
 */

import React, { useMemo, useCallback } from 'react';
import { GripVertical } from 'lucide-react';
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
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KPIWidget from './preprod/KPIWidget';
import StatusDistribution from './preprod/StatusDistribution';
import CampaignGrid from './preprod/CampaignGrid';
import type {
  DashboardMetrics,
  RawMetrics,
  Run,
  MetricAlert,
  AnomalyItem,
  MetricTemporal,
} from '../types/api.types';
import type { WidgetId, SectionType } from '../hooks/useDashboardLayout';
import '../styles/PreprodSection.css';

/* ── Sortable wrapper for KPI card ─────────────────────────────── */

interface SortableKPIProps {
  id: string;
  children: React.ReactNode;
  dragEnabled?: boolean;
}

function SortableKPI({ id, children, dragEnabled }: SortableKPIProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !dragEnabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-kpi-wrapper">
      {dragEnabled && (
        <div className="sortable-kpi-wrapper__handle" {...attributes} {...listeners} tabIndex={0} role="button" aria-label="Déplacer ce widget">
          <GripVertical size={16} />
        </div>
      )}
      {children}
    </div>
  );
}

/* ── PreprodSection Props ──────────────────────────────────────── */

interface PreprodSectionProps {
  metrics: DashboardMetrics;
  raw: RawMetrics;
  sortedRuns: Run[];
  originalRunsCount?: number;
  showAllRuns: boolean;
  setShowAllRuns: (show: boolean) => void;
  showLatestOnly?: boolean;
  setShowLatestOnly?: (show: boolean) => void;
  isDark: boolean;
  useBusiness: boolean;
  getAlertForMetric: (metric: string) => MetricAlert | undefined;
  anomalies: AnomalyItem[];
  layout?: WidgetId[];
  onMoveWidget?: (section: SectionType, oldIndex: number, newIndex: number) => void;
  dragEnabled?: boolean;
  getTemporalForMetric?: (metricName: string, currentValue: number) => MetricTemporal | null;
  onExportCard?: (element: HTMLElement, title: string) => void;
  onExportDoughnut?: (element: HTMLElement) => void;
}

const PREPROD_WIDGET_ORDER: WidgetId[] = ['completionRate', 'passRate', 'failureRate', 'testEfficiency'];

export default function PreprodSection({
  metrics,
  raw,
  sortedRuns,
  originalRunsCount,
  showAllRuns,
  setShowAllRuns,
  showLatestOnly = false,
  setShowLatestOnly,
  isDark,
  useBusiness,
  getAlertForMetric,
  anomalies,
  layout,
  onMoveWidget,
  dragEnabled = false,
  getTemporalForMetric,
  onExportCard,
  onExportDoughnut,
}: PreprodSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event: any) => {
        const { active } = event;
        const node = active?.rect?.current?.translated;
        return node ? { x: node.left, y: node.top } : { x: 0, y: 0 };
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id && onMoveWidget) {
        const items = layout || PREPROD_WIDGET_ORDER;
        const oldIndex = items.indexOf(active.id as WidgetId);
        const newIndex = items.indexOf(over.id as WidgetId);
        if (oldIndex !== -1 && newIndex !== -1) {
          onMoveWidget('preprod', oldIndex, newIndex);
        }
      }
    },
    [layout, onMoveWidget]
  );

  const widgetOrder = layout || PREPROD_WIDGET_ORDER;

  return (
    <div className="pp-section">
      <div className="pp-section-header">
        <h2 className="pp-section-title">{useBusiness ? 'PRÉPRODUCTION' : 'PREPROD'}</h2>
        <div className="pp-divider"></div>
      </div>

      {/* Grille principale Preprod */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <div className="pp-kpi-grid">
            {widgetOrder.map((widgetId) => (
              <SortableKPI key={widgetId} id={widgetId} dragEnabled={dragEnabled}>
                <KPIWidget
                  widgetId={widgetId}
                  metrics={metrics}
                  raw={raw}
                  useBusiness={useBusiness}
                  getAlertForMetric={getAlertForMetric}
                  getTemporalForMetric={getTemporalForMetric}
                  onExportCard={onExportCard}
                />
              </SortableKPI>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <StatusDistribution
        raw={raw}
        useBusiness={useBusiness}
        isDark={isDark}
        onExportDoughnut={onExportDoughnut}
      />

      <CampaignGrid
        sortedRuns={sortedRuns}
        originalRunsCount={originalRunsCount}
        showAllRuns={showAllRuns}
        setShowAllRuns={setShowAllRuns}
        showLatestOnly={showLatestOnly}
        setShowLatestOnly={setShowLatestOnly}
        useBusiness={useBusiness}
        isDark={isDark}
      />
    </div>
  );
}
