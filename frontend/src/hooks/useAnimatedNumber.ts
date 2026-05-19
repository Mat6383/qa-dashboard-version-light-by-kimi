import { useState, useEffect, useRef } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number;
  enabled?: boolean;
}

/**
 * Hook qui anime une valeur numérique avec un easing easeOutQuart.
 * Quand la valeur source change, le display s'anime progressivement
 * depuis l'ancienne valeur vers la nouvelle.
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 600, enabled = true } = options;
  const [displayValue, setDisplayValue] = useState(targetValue);
  const prevValueRef = useRef(targetValue);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDisplayValue(targetValue);
      prevValueRef.current = targetValue;
      return;
    }

    const start = prevValueRef.current;
    const end = targetValue;

    if (start === end) return;

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (end - start) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = end;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      prevValueRef.current = targetValue;
    };
  }, [targetValue, duration, enabled]);

  return displayValue;
}
