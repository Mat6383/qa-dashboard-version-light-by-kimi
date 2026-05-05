import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Wrench, Settings } from 'lucide-react';

interface NavItem {
  path: string;
  labelKey: string;
  icon: React.ReactNode;
}

function getNavItems(isAdmin: boolean, t: (key: string) => string): NavItem[] {
  const items: NavItem[] = [
    { path: '/global-view', labelKey: 'nav.global', icon: <Globe size={20} /> },
    { path: '/tools', labelKey: 'nav.tools', icon: <Wrench size={20} /> },
  ];
  if (isAdmin) {
    items.push({ path: '/admin/feature-flags', labelKey: 'nav.flags', icon: <Settings size={20} /> });
  }
  return items;
}

interface MobileBottomNavProps {
  isAdmin: boolean;
}

export default function MobileBottomNav({ isAdmin }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const items = getNavItems(isAdmin, t);

  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label={t('layout.bottomNav')}>
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            type="button"
          >
            <span className="mobile-bottom-nav-icon">{item.icon}</span>
            <span className="mobile-bottom-nav-label">{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
