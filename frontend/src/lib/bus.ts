import { useEffect } from 'react';

/** Tiny app-wide event bus so unrelated views can refresh each other. */
type Topic = 'lists' | 'clubs' | 'notifications' | 'reviews' | 'progress' | 'theme';

const target = new EventTarget();

export function emit(topic: Topic) {
  target.dispatchEvent(new Event(topic));
}

export function on(topic: Topic, handler: () => void): () => void {
  target.addEventListener(topic, handler);
  return () => target.removeEventListener(topic, handler);
}

/** Re-runs `handler` whenever any of the given topics fire. */
export function useBus(topics: Topic[], handler: () => void) {
  const key = topics.join('|');
  useEffect(() => {
    const offs = topics.map((t) => on(t, handler));
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handler]);
}
