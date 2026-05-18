/**
 * ================================================
 * PRODUCTION SECTION — Dashboard4 Production v3
 * ================================================
 * Option C "Pro Suite" enhancements:
 * - Sortable KPI grid (drag & drop)
 * - Temporal comparison deltas (J-7 / J-14 / J-30)
 * - Per-card export (PNG/PDF)
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 3.0.0
 */

import React, { useCallback } from 'react';
import { ShieldAlert, ShieldCheck, GripVertical } from 'lucide-react';
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
import KPICard from './KPICard';
import { getMetricColor, getMetricLevel } from '../lib/colors';
import type { AnomalyItem, QualityRates, KpiStatus, KpiTrend, MetricTemporal } from '../types/api.types';
import type { WidgetId, SectionType } from '../hooks/useDashboardLayout';
import '../styles/ProductionSection.css';

interface ProductionRates extends QualityRates {
  prodMilestone: string;
  bugsInProd: number;
  bugsInTest: number;
}

interface ProductionSectionProps {
  rates: ProductionRates | null;
  escapeOk: boolean;
  ddpOk: boolean;
  showProductionSection: boolean;
  onToggleProductionSection?: (show: boolean) => void;
  isDark: boolean;
  useBusiness: boolean;
  anomalies: AnomalyItem[];
  // Option C
  layout?: WidgetId[];
  onMoveWidget?: (section: SectionType, oldIndex: number, newIndex: number) => void;
  dragEnabled?: boolean;
  getTemporalForMetric?: (metricName: string, currentValue: number) => MetricTemporal | null;
  onExportCard?: (element: HTMLElement, title: string) => void;
}

function getKpiStatus(metricName: string, value: number): KpiStatus {
  const level = getMetricLevel(metricName, value);
  if (level === 'success') return 'ok';
  if (level === 'warning') return 'warning';
  return 'critical';
}

function getKpiTrend(metricName: string, value: number): KpiTrend {
  const level = getMetricLevel(metricName, value);
  if (level === 'success') return 'up';
  if (level === 'danger') return 'down';
  return 'neutral';
}

function getTrend(anomalies: AnomalyItem[], metricKey: string): import('../types/api.types').MetricAlert | null {
  const a = anomalies?.find((a) => a.metric === metricKey);
  if (!a) return null;
  return {
    severity: a.severity === 'high' ? 'critical' : a.severity,
    message: `Anomalie ${a.metric} (z-score: ${a.zScore.toFixed(2)})`,
  };
}

/* ── Sortable wrapper ──────────────────────────────────────────── */

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

const PROD_WIDGET_ORDER: WidgetId[] = ['escapeRate', 'detectionRate'];

export default function ProductionSection({
  rates,
  escapeOk: _escapeOk,
  ddpOk: _ddpOk,
  showProductionSection,
  onToggleProductionSection,
  isDark,
  useBusiness,
  anomalies,
  layout,
  onMoveWidget,
  dragEnabled = false,
  getTemporalForMetric,
  onExportCard,
}: ProductionSectionProps) {
  if (!rates) return null;

  const milestoneDisplay = rates.prodMilestone && rates.prodMilestone !== 'N/A' ? rates.prodMilestone : '—';

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
        const items = layout || PROD_WIDGET_ORDER;
        const oldIndex = items.indexOf(active.id as WidgetId);
        const newIndex = items.indexOf(over.id as WidgetId);
        if (oldIndex !== -1 && newIndex !== -1) {
          onMoveWidget('production', oldIndex, newIndex);
        }
      }
    },
    [layout, onMoveWidget]
  );

  const widgetOrder = layout || PROD_WIDGET_ORDER;

  const renderWidget = (widgetId: WidgetId) => {
    const buildPills = (t: MetricTemporal | null) => {
      if (!t) return null;
      const pills = [];
      if (t.values.j7?.value != null) {
        pills.push({ label: 'J-7', value: `${Math.round(t.values.j7.value)}%` });
      }
      if (t.values.j14?.value != null) {
        pills.push({ label: 'J-14', value: `${Math.round(t.values.j14.value)}%` });
      }
      if (t.values.j30?.value != null) {
        pills.push({ label: 'J-30', value: `${Math.round(t.values.j30.value)}%` });
      }
      return pills.length > 0 ? pills : null;
    };

    switch (widgetId) {
      case 'escapeRate': {
        const t = getTemporalForMetric?.('escapeRate', rates.escapeRate);
        return (
          <KPICard
            title={useBusiness ? "Taux d'Échappement" : 'Escape Rate'}
            icon={<ShieldAlert size={20} />}
            value={Math.round(rates.escapeRate)}
            status={getKpiStatus('escapeRate', rates.escapeRate)}
            trend={getKpiTrend('escapeRate', rates.escapeRate)}
            subtitle={`${useBusiness ? 'Jalon' : 'Milestone'}: ${milestoneDisplay} • Objectif: < 5%`}
            alert={getTrend(anomalies, 'escape_rate')}
            delta={t?.delta7 != null ? { value: t.delta7, label: 'vs J-7' } : null}
            invertDeltaColors
            comparisonPills={buildPills(t)}
            onExport={onExportCard ? (el) => onExportCard(el, useBusiness ? "Taux d'Échappement" : 'Escape Rate') : null}
          />
        );
      }
      case 'detectionRate': {
        const t = getTemporalForMetric?.('detectionRate', rates.detectionRate);
        return (
          <KPICard
            title={useBusiness ? 'Taux de Détection' : 'Detection Rate'}
            icon={<ShieldCheck size={20} />}
            value={Math.round(rates.detectionRate)}
            status={getKpiStatus('detectionRate', rates.detectionRate)}
            trend={getKpiTrend('detectionRate', rates.detectionRate)}
            subtitle={`${useBusiness ? 'Lié' : 'Linked'}: ${milestoneDisplay} • Objectif: > 95%`}
            alert={getTrend(anomalies, 'detection_rate')}
            delta={t?.delta7 != null ? { value: t.delta7, label: 'vs J-7' } : null}
            comparisonPills={buildPills(t)}
            onExport={onExportCard ? (el) => onExportCard(el, useBusiness ? 'Taux de Détection' : 'Detection Rate') : null}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="prod-section">
      <div className="prod-header">
        <h2>{useBusiness ? 'PRODUCTION' : 'PRODUCTION'}</h2>
        {onToggleProductionSection && (
          <div
            className="prod-toggle"
            onClick={() => onToggleProductionSection(!showProductionSection)}
            role="switch"
            aria-checked={showProductionSection}
            tabIndex={0}
          >
            <span className={`prod-toggle-label ${showProductionSection ? 'prod-toggle-label--active' : 'prod-toggle-label--inactive'}`}>
              {showProductionSection ? 'Visible' : 'Masqué'}
            </span>
            <div className={`prod-toggle-track ${showProductionSection ? 'prod-toggle-track--active' : 'prod-toggle-track--inactive'}`}>
              <div className={`prod-toggle-thumb ${showProductionSection ? 'prod-toggle-thumb--active' : 'prod-toggle-thumb--inactive'}`} />
            </div>
          </div>
        )}
        <div className="prod-header-line"></div>
      </div>

      {showProductionSection && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
            <div className="prod-kpi-grid">
              {widgetOrder.map((widgetId) => (
                <SortableKPI key={widgetId} id={widgetId} dragEnabled={dragEnabled}>
                  {renderWidget(widgetId)}
                </SortableKPI>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
