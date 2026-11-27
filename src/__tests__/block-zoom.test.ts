import { describe, expect, it } from 'vitest';
import { blockZoom } from '../block-zoom';

function fire(doc: EventTarget, type: string, extra: Record<string, unknown> = {}): boolean {
  const e = new Event(type, { cancelable: true });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v }); // timeStamp는 읽기 전용 접근자
  doc.dispatchEvent(e);
  return e.defaultPrevented;
}

describe('blockZoom', () => {
  const setup = (): EventTarget => {
    const d = new EventTarget();
    blockZoom(d);
    return d;
  };

  it('gesturestart·gesturechange를 막는다', () => {
    const d = setup();
    expect(fire(d, 'gesturestart')).toBe(true);
    expect(fire(d, 'gesturechange')).toBe(true);
  });

  it('두 손가락 touchmove만 막고 한 손가락 끌기는 둔다', () => {
    const d = setup();
    expect(fire(d, 'touchmove', { touches: [{}, {}] })).toBe(true);
    expect(fire(d, 'touchmove', { touches: [{}] })).toBe(false);
  });

  it('300ms 안의 두 번째 touchend를 막고, 느린 탭은 둔다', () => {
    const d = setup();
    expect(fire(d, 'touchend', { timeStamp: 1000 })).toBe(false);
    expect(fire(d, 'touchend', { timeStamp: 1200 })).toBe(true);
    expect(fire(d, 'touchend', { timeStamp: 2000 })).toBe(false);
  });

  it('버튼·입력 요소의 연속 touchend는 막지 않는다', () => {
    const d = setup();
    const button = { closest: () => ({}) };
    fire(d, 'touchend', { timeStamp: 1000, target: button });
    expect(fire(d, 'touchend', { timeStamp: 1100, target: button })).toBe(false);
  });
});
