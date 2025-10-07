import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to ensure loading state displays for a minimum duration
 * @param actualLoading - The actual loading state from API/data fetching
 * @param minimumMs - Minimum time in milliseconds to show loading (default: 3000ms)
 * @returns The loading state that respects minimum duration
 */
export function useMinimumLoadingTime(actualLoading: boolean, minimumMs: number = 3000): boolean {
  const [displayLoading, setDisplayLoading] = useState(false);
  const loadingStartTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // When actual loading starts
    if (actualLoading && !displayLoading) {
      loadingStartTimeRef.current = Date.now();
      setDisplayLoading(true);
    }

    // When actual loading finishes
    if (!actualLoading && displayLoading) {
      const elapsedTime = loadingStartTimeRef.current 
        ? Date.now() - loadingStartTimeRef.current 
        : 0;
      
      const remainingTime = Math.max(0, minimumMs - elapsedTime);

      if (remainingTime > 0) {
        // Wait for remaining time before hiding loading
        timeoutRef.current = setTimeout(() => {
          setDisplayLoading(false);
          loadingStartTimeRef.current = null;
        }, remainingTime);
      } else {
        // Minimum time already passed, hide immediately
        setDisplayLoading(false);
        loadingStartTimeRef.current = null;
      }
    }

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [actualLoading, displayLoading, minimumMs]);

  return displayLoading;
}

