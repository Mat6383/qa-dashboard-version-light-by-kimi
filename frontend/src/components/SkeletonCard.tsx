/**
 * ================================================
 * SKELETON CARD — Placeholder shimmer pour KPI
 * ================================================
 * Animation CSS pure, pas de librairie externe.
 */

import React from 'react';

interface SkeletonCardProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export default function SkeletonCard({
  width = '100%',
  height = 120,
  borderRadius = 'var(--radius-lg)',
  className = '',
}: SkeletonCardProps) {
  return (
    <div
      className={`skeleton-card ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
      }}
      aria-hidden="true"
    />
  );
}
