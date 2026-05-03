import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  labelKey: string;
  path?: string;
}

function getBreadcrumbItems(pathname: string, t: (key: string) => string): BreadcrumbItem[] {
  if (!pathname.startsWith('/admin/')) return [];

  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ labelKey: 'breadcrumb.admin', path: '/admin/audit' }];

  if (segments.length >= 2) {
    const pageMap: Record<string, string> = {
      audit: 'breadcrumb.auditLogs',
      'feature-flags': 'breadcrumb.featureFlags',
      analytics: 'breadcrumb.analytics',
      retention: 'breadcrumb.retention',
      integrations: 'breadcrumb.integrations',
    };
    const page = segments[1];
    items.push({ labelKey: pageMap[page] || page });
  }

  return items;
}

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const items = getBreadcrumbItems(pathname, t);
  const currentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (items.length > 0 && currentRef.current) {
      currentRef.current.focus({ preventScroll: true });
    }
  }, [pathname, items.length]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb-nav">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <Link to="/" className="breadcrumb-link">
            <Home size={14} />
            <span className="sr-only">{t('nav.home')}</span>
          </Link>
          <ChevronRight size={14} className="breadcrumb-separator" aria-hidden="true" />
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.labelKey} className="breadcrumb-item">
              {item.path && !isLast ? (
                <Link to={item.path} className="breadcrumb-link">
                  {t(item.labelKey)}
                </Link>
              ) : (
                <span
                  ref={isLast ? currentRef : null}
                  className="breadcrumb-current"
                  aria-current="page"
                  tabIndex={-1}
                >
                  {t(item.labelKey)}
                </span>
              )}
              {!isLast && <ChevronRight size={14} className="breadcrumb-separator" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
