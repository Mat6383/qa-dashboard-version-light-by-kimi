/**
 * ================================================
 * SKELETON DASHBOARD — Layout skeleton pour Dashboard4
 * ================================================
 * Reproduit la structure du dashboard en état de chargement.
 */

import React from 'react';
import SkeletonCard from './SkeletonCard';

export default function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard" aria-label="Chargement du dashboard" role="status">
      {/* Banner skeleton */}
      <div className="skeleton-dashboard__banner">
        <SkeletonCard height={48} borderRadius="var(--radius-md)" />
      </div>

      {/* KPI row */}
      <div className="skeleton-dashboard__kpi-row">
        <SkeletonCard height={140} />
        <SkeletonCard height={140} />
        <SkeletonCard height={140} />
        <SkeletonCard height={140} />
      </div>

      {/* Sections */}
      <div className="skeleton-dashboard__section">
        <SkeletonCard height={32} borderRadius="var(--radius-md)" />
        <SkeletonCard height={200} />
      </div>

      <div className="skeleton-dashboard__section">
        <SkeletonCard height={32} borderRadius="var(--radius-md)" />
        <SkeletonCard height={160} />
      </div>
    </div>
  );
}
