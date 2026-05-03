import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    setMatches(media.matches);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}

export function usePrefersColorScheme(): 'light' | 'dark' | 'no-preference' {
  const isDark = useMediaQuery('(prefers-color-scheme: dark)');
  const isLight = useMediaQuery('(prefers-color-scheme: light)');
  if (isDark) return 'dark';
  if (isLight) return 'light';
  return 'no-preference';
}
