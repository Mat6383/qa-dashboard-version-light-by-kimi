import React, { useRef, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { BarChart3, Download } from 'lucide-react';
import { buildChartOptions, buildDoughnutChartData } from '../../lib/charts';

ChartJS.register(ArcElement, Tooltip, Legend);
import type { RawMetrics } from '../../types/api.types';

interface StatusDistributionProps {
  raw: RawMetrics;
  useBusiness: boolean;
  isDark: boolean;
  onExportDoughnut?: (element: HTMLElement) => void;
}

export default function StatusDistribution({ raw, useBusiness, isDark, onExportDoughnut }: StatusDistributionProps) {
  const doughnutRef = useRef<HTMLDivElement>(null);
  const statusChartData = useMemo(() => buildDoughnutChartData(raw, useBusiness, isDark), [raw, useBusiness, isDark]);
  const statusChartOptions = useMemo(() => buildChartOptions('doughnut', isDark), [isDark]);

  return (
    <div className="pp-status-section" ref={doughnutRef}>
      <div className="pp-status-header">
        <BarChart3 size={24} />
        <span>{useBusiness ? 'Répartition Globale' : 'Global Distribution'}</span>
        {onExportDoughnut && (
          <button
            className="pp-status-export"
            onClick={() => doughnutRef.current && onExportDoughnut(doughnutRef.current)}
            type="button"
            title="Exporter ce graphique"
            aria-label="Exporter le graphique de répartition"
          >
            <Download size={14} />
          </button>
        )}
      </div>
      <div className="pp-status-chart">
        <div className="pp-doughnut-wrap">
          <Doughnut data={statusChartData} options={statusChartOptions} />
        </div>
      </div>
    </div>
  );
}
