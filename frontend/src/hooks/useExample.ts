import { useState, useEffect, useCallback } from 'react';
import { exampleStore } from '@/data/exampleStore';

/**
 * Hook for managing example/placeholder content state.
 * Returns whether example content should be shown,
 * and a function to dismiss it.
 */
export function useExample() {
  const [showExample, setShowExample] = useState(() => !exampleStore.hasRealContent());

  useEffect(() => {
    const unsub = exampleStore.onDismiss(() => {
      setShowExample(false);
    });
    return unsub;
  }, []);

  const dismiss = useCallback(() => {
    exampleStore.dismiss();
    setShowExample(false);
  }, []);

  return { showExample, dismiss };
}
