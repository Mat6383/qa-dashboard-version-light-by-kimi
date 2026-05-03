import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function MobileDrawer({ isOpen, onClose, title, children }: MobileDrawerProps) {
  const { t } = useTranslation();
  const drawerRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="mobile-drawer-overlay" onClick={onClose} role="presentation">
      <div
        ref={drawerRef}
        className="mobile-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mobile-drawer-header">
          <h2>{title}</h2>
          <button
            className="btn-icon"
            onClick={onClose}
            aria-label={t('common.close')}
            type="button"
            data-modal-close
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="mobile-drawer-content">{children}</div>
      </div>
    </div>
  );
}
