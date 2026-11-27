// iOS Safari는 user-scalable=no를 무시하므로 핀치·더블탭 확대를 이벤트로 막는다. 한 손가락 끌기·탭은 막지 않는다.
const DOUBLE_TAP_MS = 300;
const INTERACTIVE = 'button, input, select, textarea, a';

type TouchLike = { touches?: ArrayLike<unknown>; target?: { closest?(s: string): unknown } | null; timeStamp: number };

export function blockZoom(doc: EventTarget): void {
  const stop = (e: Event): void => e.preventDefault();
  doc.addEventListener('gesturestart', stop, { passive: false });
  doc.addEventListener('gesturechange', stop, { passive: false });
  doc.addEventListener(
    'touchmove',
    (e) => {
      if (((e as unknown as TouchLike).touches?.length ?? 0) > 1) e.preventDefault();
    },
    { passive: false },
  );
  let lastEnd = -Infinity;
  doc.addEventListener(
    'touchend',
    (e) => {
      const t = e as unknown as TouchLike;
      const interactive = t.target?.closest?.(INTERACTIVE) != null; // 버튼 click은 살린다.
      if (!interactive && t.timeStamp - lastEnd < DOUBLE_TAP_MS) e.preventDefault();
      lastEnd = t.timeStamp;
    },
    { passive: false },
  );
}
