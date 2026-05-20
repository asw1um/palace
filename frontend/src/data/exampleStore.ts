const LS_KEY = 'palace_has_real_content';

/**
 * Tracks whether the user has added any real content.
 * Once set to true, example/placeholder content is hidden across the app.
 */
export const exampleStore = {
  /** Check if user has added real content */
  hasRealContent(): boolean {
    try {
      return localStorage.getItem(LS_KEY) === 'true';
    } catch { return false; }
  },

  /** Mark that user has added real content — hides all example data */
  dismiss(): void {
    localStorage.setItem(LS_KEY, 'true');
    window.dispatchEvent(new CustomEvent('exampledismiss'));
  },

  /** Reset — for debugging/testing */
  reset(): void {
    localStorage.removeItem(LS_KEY);
    window.dispatchEvent(new CustomEvent('exampledismiss'));
  },

  /** Add a one-time listener for dismissal */
  onDismiss(cb: () => void): () => void {
    window.addEventListener('exampledismiss', cb);
    return () => window.removeEventListener('exampledismiss', cb);
  },
};

/** Wraps a value with example flag */
export function example<T>(value: T): T & { _isExample: true } {
  return Object.assign(value as any, { _isExample: true as const });
}

/** Type guard for example items */
export function isExample<T>(item: T): boolean {
  return (item as any)?._isExample === true;
}
