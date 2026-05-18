/**
 * ================================================
 * TV MODE OVERLAY — Mode TV optimisé Option C
 * ================================================
 * Cycle auto plein écran des slides :
 * KPIs → Production → Doughnut
 * Pas d'interaction requise. Information radiateur.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Monitor } from 'lucide-react';
import KPICard from './KPICard';
import type { DashboardMetrics, RawMetrics, Run, AnomalyItem, QualityRates } from '../types/api.types';

interface TVSlide {
  id: string;
  label: string;
}

const SLIDES: TVSlide[] = [
  { id: 'kpis', label: 'KPIs Préproduction' },
  { id: 'production', label: 'Production' },
  { id: 'doughnut', label: 'Répartition' },
];

const SLIDE_INTERVAL_MS = 10000;

interface TVModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: DashboardMetrics | null;
  raw: RawMetrics;
  rates: QualityRates | null;
  anomalies: AnomalyItem[];
  useBusiness: boolean;
  projectName?: string;
}

export default function TVModeOverlay({
  isOpen,
  onClose,
  metrics,
  raw,
  rates,
  anomalies,
  useBusiness,
  projectName,
}: TVModeOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goToNextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (isFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
      return;
    }

    // Request fullscreen
    const requestFs = async () => {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        /* ignore */
      }
    };
    requestFs();

    // Start cycling
    timerRef.current = setInterval(goToNextSlide, SLIDE_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, goToNextSlide]);

  // Keyboard: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowRight') {
        setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
      }
      if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !metrics) return null;

  const d1 = metrics;

  const slideId = SLIDES[currentSlide].id;

  return (
    <div
      ref={containerRef}
      className="tv-mode-overlay"
      role="dialog"
      aria-label="Mode TV"
      aria-modal="true"
    >
      {/* Header */}
      <div className="tv-mode-overlay__header">
        <div className="tv-mode-overlay__title">
          <Monitor size={20} />
          <span>{projectName || 'Dashboard'}</span>
        </div>
        <div className="tv-mode-overlay__controls">
          <span className="tv-mode-overlay__indicator">
            Slide {currentSlide + 1}/{SLIDES.length} — {SLIDES[currentSlide].label}
          </span>
          <button
            className="tv-mode-overlay__close"
            onClick={onClose}
            type="button"
            aria-label="Quitter le mode TV"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="tv-mode-overlay__content">
        {slideId === 'kpis' && (
          <div className="tv-mode-overlay__slide tv-mode-overlay__slide--kpis">
            <div className="tv-mode-overlay__grid tv-mode-overlay__grid--4">
              <KPICard
                title={useBusiness ? "Taux d'Exécution" : 'Execution Rate'}
                value={Math.round(d1.completionRate)}
                status={d1.completionRate >= 90 ? 'ok' : d1.completionRate >= 70 ? 'warning' : 'critical'}
                subtitle={`${raw.completed} / ${raw.total} ${useBusiness ? 'tests exécutés' : 'tests executed'}`}
                progress={{ value: d1.completionRate, label: `${raw.completed} / ${raw.total}` }}
              />
              <KPICard
                title={useBusiness ? 'Taux de Succès' : 'Pass Rate'}
                value={Math.round(d1.passRate)}
                status={d1.passRate >= 95 ? 'ok' : d1.passRate >= 80 ? 'warning' : 'critical'}
                subtitle={`${raw.passed} / ${raw.total} ${useBusiness ? 'tests réussis' : 'tests passed'}`}
                progress={{ value: d1.passRate, label: `${raw.passed} / ${raw.total}` }}
              />
              <KPICard
                title={useBusiness ? "Taux d'Échec" : 'Failure Rate'}
                value={Math.round(d1.failureRate)}
                status={d1.failureRate <= 5 ? 'ok' : d1.failureRate <= 15 ? 'warning' : 'critical'}
                subtitle={`${raw.failed} / ${raw.total} ${useBusiness ? 'tests échoués' : 'tests failed'}`}
                progress={{ value: d1.failureRate, label: `${raw.failed} / ${raw.total}` }}
              />
              <KPICard
                title={useBusiness ? 'Efficience des tests' : 'Test Efficiency'}
                value={Math.round(d1.testEfficiency)}
                status={d1.testEfficiency >= 95 ? 'ok' : d1.testEfficiency >= 80 ? 'warning' : 'critical'}
                subtitle={`${raw.passed} / ${raw.passed + raw.failed}`}
                progress={{ value: d1.testEfficiency, label: `${raw.passed} / ${raw.passed + raw.failed}` }}
              />
            </div>
          </div>
        )}

        {slideId === 'production' && rates && (
          <div className="tv-mode-overlay__slide tv-mode-overlay__slide--production">
            <div className="tv-mode-overlay__grid tv-mode-overlay__grid--2">
              <KPICard
                title={useBusiness ? "Taux d'Échappement" : 'Escape Rate'}
                value={Math.round(rates.escapeRate)}
                status={rates.escapeRate < 5 ? 'ok' : rates.escapeRate < 10 ? 'warning' : 'critical'}
                subtitle={`${useBusiness ? 'Objectif' : 'Target'}: < 5%`}
              />
              <KPICard
                title={useBusiness ? 'Taux de Détection' : 'Detection Rate'}
                value={Math.round(rates.detectionRate)}
                status={rates.detectionRate > 95 ? 'ok' : rates.detectionRate > 80 ? 'warning' : 'critical'}
                subtitle={`${useBusiness ? 'Objectif' : 'Target'}: > 95%`}
              />
            </div>
          </div>
        )}

        {slideId === 'doughnut' && (
          <div className="tv-mode-overlay__slide tv-mode-overlay__slide--doughnut">
            <div className="tv-mode-overlay__doughnut-info">
              <div className="tv-mode-overlay__doughnut-title">
                {useBusiness ? 'Répartition Globale' : 'Global Distribution'}
              </div>
              <div className="tv-mode-overlay__doughnut-stats">
                <div className="tv-mode-overlay__stat">
                  <span className="tv-mode-overlay__stat-dot" style={{ background: 'var(--status-success)' }} />
                  <span>{useBusiness ? 'Réussis' : 'Passed'} — {raw.passed}</span>
                </div>
                <div className="tv-mode-overlay__stat">
                  <span className="tv-mode-overlay__stat-dot" style={{ background: 'var(--status-danger)' }} />
                  <span>{useBusiness ? 'Échoués' : 'Failed'} — {raw.failed}</span>
                </div>
                <div className="tv-mode-overlay__stat">
                  <span className="tv-mode-overlay__stat-dot" style={{ background: 'var(--status-info)' }} />
                  <span>{useBusiness ? 'En cours' : 'WIP'} — {raw.wip}</span>
                </div>
                <div className="tv-mode-overlay__stat">
                  <span className="tv-mode-overlay__stat-dot" style={{ background: 'var(--status-warning)' }} />
                  <span>{useBusiness ? 'Bloqués' : 'Blocked'} — {raw.blocked}</span>
                </div>
                <div className="tv-mode-overlay__stat">
                  <span className="tv-mode-overlay__stat-dot" style={{ background: 'var(--text-muted)' }} />
                  <span>{useBusiness ? 'Non testés' : 'Untested'} — {raw.untested}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div className="tv-mode-overlay__dots">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            className={`tv-mode-overlay__dot ${idx === currentSlide ? 'active' : ''}`}
            onClick={() => setCurrentSlide(idx)}
            type="button"
            aria-label={`Aller au slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
