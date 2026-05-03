/**
 * ================================================
 * STATUS CHART COMPONENT
 * ================================================
 * Graphique de distribution des statuts de tests
 * 
 * ISTQB: Test Status Distribution
 * LEAN: Visualisation claire et actionnable
 * 
 * @author Matou - Neo-Logix QA Lead
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import '../styles/StatusChart.css';
import type { ChartOptions } from 'chart.js';

// Enregistrer les composants Chart.js
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const StatusChart = ({ metrics, chartType = 'doughnut', useBusiness, isDark = false }) => {
  const { t } = useTranslation();

  if (!metrics || !metrics.statusDistribution) {
    return <div className="chart-loading">{t('statusChart.loading')}</div>;
  }

  const { labels, values, colors } = metrics.statusDistribution;

  // Configuration Doughnut Chart
  const doughnutData = {
    labels: labels,
    datasets: [
      {
        label: t('statusChart.numberOfTests'),
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c + 'CC'),
        borderWidth: 2,
        hoverOffset: 10
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          color: 'var(--text-color)',
          font: {
            size: 12,
            family: "'Inter', sans-serif"
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} tests (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: useBusiness ? t('statusChart.doughnutTitleBusiness') : t('statusChart.doughnutTitle'),
        color: 'var(--text-color)',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 20
        }
      }
    }
  } satisfies ChartOptions<'doughnut'>;

  // Configuration Bar Chart
  const barData = {
    labels: labels,
    datasets: [
      {
        label: t('statusChart.numberOfTests'),
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c + 'CC'),
        borderWidth: 2
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.parsed.y || 0;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value} tests (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: useBusiness ? t('statusChart.barTitleBusiness') : t('statusChart.barTitle'),
        color: isDark ? 'var(--text-color)' : 'var(--text-color)',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: 'var(--text-muted)'
        },
        grid: {
          color: 'var(--border-color)'
        }
      },
      x: {
        ticks: {
          color: 'var(--text-muted)'
        },
        grid: {
          display: false
        }
      }
    }
  } satisfies ChartOptions<'bar'>;

  const totalTests = values.reduce((a, b) => a + b, 0);
  const summaryText = labels.map((label, i) => `${label}: ${values[i]} (${((values[i] / totalTests) * 100).toFixed(1)}%)`).join(', ');

  return (
    <div className="status-chart-container">
      <div className="chart-wrapper" aria-label={t('statusChart.ariaLabel', { summary: summaryText })} role="img">
        {chartType === 'doughnut' ? (
          <Doughnut data={doughnutData} options={doughnutOptions} />
        ) : (
          <Bar data={barData} options={barOptions} />
        )}
      </div>

      {/* Alternative tabulaire pour les lecteurs d'écran */}
      <table className="sr-only">
        <caption>{useBusiness ? t('statusChart.tableCaptionBusiness') : t('statusChart.tableCaption')}</caption>
        <thead>
          <tr>
            <th>{t('statusChart.status')}</th>
            <th>{t('statusChart.count')}</th>
            <th>{t('statusChart.percentage')}</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={index}>
              <td>{label}</td>
              <td>{values[index]}</td>
              <td>{((values[index] / totalTests) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Statistiques détaillées */}
      <div className="status-details">
        <h4>{t('statusChart.details')}</h4>
        <div className="status-list">
          {labels.map((label, index) => (
            <StatusItem
              key={index}
              label={label}
              value={values[index]}
              color={colors[index]}
              total={totalTests}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Item de statut individuel
 */
const StatusItem = ({ label, value, color, total }) => {
  const percentage = ((value / total) * 100).toFixed(1);

  return (
    <div className="status-item">
      <div className="status-header">
        <div className="status-label">
          <span
            className="status-indicator"
            style={{ backgroundColor: color }}
          />
          <span className="label-text">{label}</span>
        </div>
        <span className="status-value">{value}</span>
      </div>
      <div className="status-bar">
        <div
          className="status-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
      <div className="status-percentage">{percentage}%</div>
    </div>
  );
};

export default StatusChart;
