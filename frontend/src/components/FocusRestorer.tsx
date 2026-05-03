import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Remet le focus sur la zone principale de contenu à chaque changement de route.
 * Pattern d'accessibilité pour les lecteurs d'écran.
 */
export default function FocusRestorer() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.focus({ preventScroll: true });
    }
  }, [pathname]);

  return null;
}
