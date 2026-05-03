import React, { useEffect, useCallback } from 'react';

interface ShortcutHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: 'Échap', action: 'Fermer le modal' },
  { keys: 'Entrée', action: "Confirmer l'action principale" },
  { keys: 'Ctrl + S', action: 'Sauvegarder le formulaire' },
  { keys: '?', action: 'Afficher / masquer cette aide' },
];

export default function ShortcutHelpOverlay({ isOpen, onClose }: ShortcutHelpOverlayProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="shortcut-help-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Aide des raccourcis clavier"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="shortcut-help-modal"
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          color: 'var(--text-color, #111827)',
          borderRadius: '0.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          padding: '1.5rem',
          maxWidth: '28rem',
          width: '90%',
        }}
      >
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          Raccourcis clavier
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              color: 'var(--text-muted, #6b7280)',
            }}
            type="button"
          >
            ×
          </button>
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {shortcuts.map((shortcut) => (
              <tr key={shortcut.keys} style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
                <td
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    width: '40%',
                  }}
                >
                  {shortcut.keys}
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted, #6b7280)' }}>
                  {shortcut.action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
