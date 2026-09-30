import { useEffect, useRef } from 'react';

/**
 * Runs `callback` every `intervalMs` while the page is visible, and again straight away when the
 * user comes back to the tab or window. Never runs two at once. Used to keep open screens up to date
 * without a manual refresh.
 */
export function useLivePolling(callback: () => Promise<unknown> | void, intervalMs: number, enabled = true) {
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let running = false;

    const tick = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        await latest.current();
      } catch {
        /* the next tick will try again */
      } finally {
        running = false;
      }
    };

    const timer = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, enabled]);
}
