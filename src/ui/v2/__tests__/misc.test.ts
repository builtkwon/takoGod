import { describe, expect, it } from 'vitest';
import { arrowGeometry, tutorialArrow } from '../arrow';
import { barView } from '../bar';
import { createSequencer, type Clock } from '../sequencer';
import { deltaText, scoreText } from '../reveal';
import { stateOf, stubPicker } from './helpers';

describe('barView', () => {
  it('영역이 있으면 활성(굴릴 수 있는 구멍), W1은 step 1', () => {
    const s = stateOf(['empty', 'filled'], { barPosition: 0.25, barZone: { from: 0.4, to: 0.6 } });
    expect(barView(s)).toEqual({ markerPct: 25, zone: { leftPct: 40, widthPct: 20 }, active: true, step: 1 });
  });
  it('익힘 완료 구멍만 있고 영역이 없으면 비활성', () => {
    expect(barView(stateOf(['cooked'], { barZone: null })).active).toBe(false);
  });
  it('W2 영역은 step 2', () => {
    const z = { from: 0.42, to: 0.58 };
    const base = stateOf(['rolled']);
    expect(barView({ ...base, barZone: z, holes: [{ ...base.holes[0]!, rollZone: z }] }).step).toBe(2);
  });
  it('영역 없음·범위 밖·NaN', () => {
    const s = stateOf(['done'], { barPosition: Number.NaN, barZone: null });
    expect(barView(s)).toEqual({ markerPct: 0, zone: null, active: false, step: null });
    expect(barView(stateOf([], { barPosition: 2 })).markerPct).toBe(100);
  });
});

describe('tutorialArrow', () => {
  const buckets = { margarine: () => ({ x: 5, y: 5 }), batter: () => ({ x: 395, y: 5 }) };
  it('마가린: 통 → 빈 첫 구멍', () => {
    const s = stateOf(['greased', 'empty']);
    expect(tutorialArrow('margarine', s, stubPicker(), buckets)).toEqual({ from: { x: 5, y: 5 }, to: { x: 150, y: 150 } });
  });
  it('속재료: 문어 칸 → 익힘 완료 구멍', () => {
    const s = stateOf(['cooking', 'cooked']);
    expect(tutorialArrow('filling', s, stubPicker(), buckets)).toEqual({ from: { x: 50, y: 350 }, to: { x: 150, y: 150 } });
  });
  it('굴리기: 구멍 위에서 아래로, 후네: 완성 구멍 → 후네', () => {
    expect(tutorialArrow('roll-1', stateOf(['filled']), stubPicker(), buckets)?.to).toEqual({ x: 50, y: 150 });
    expect(tutorialArrow('fune', stateOf(['done']), stubPicker(), buckets)).toEqual({ from: { x: 50, y: 150 }, to: { x: 200, y: 550 } });
  });
  it('익힘 기다림·대상 구멍 없음은 null', () => {
    expect(tutorialArrow('cook-wait', stateOf(['cooking']), stubPicker(), buckets)).toBeNull();
    expect(tutorialArrow('batter', stateOf(['empty']), stubPicker(), buckets)).toBeNull();
  });
  it('arrowGeometry', () => {
    expect(arrowGeometry({ x: 0, y: 0 }, { x: 0, y: 10 })).toEqual({ x: 0, y: 0, length: 10, angle: 90 });
  });
});

function fakeClock() {
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const clock: Clock = { set: (fn, ms) => timers.push({ at: now + ms, fn }), clear: () => void (timers.length = 0) };
  const advance = (ms: number): void => {
    now += ms;
    for (const t of timers.filter((x) => x.at <= now)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
  };
  return { clock, advance };
}

describe('sequencer', () => {
  it('도착 순서대로 하나씩 실행하고 hold 뒤 정리한다', () => {
    const { clock, advance } = fakeClock();
    const seq = createSequencer(clock);
    const log: string[] = [];
    seq.push(() => (log.push('a'), () => log.push('a-end')), 100);
    seq.push(() => void log.push('b'), 100);
    expect(log).toEqual(['a']);
    advance(100);
    expect(log).toEqual(['a', 'a-end', 'b']);
    advance(100);
    seq.push(() => void log.push('c'), 0);
    expect(log.at(-1)).toBe('c');
  });
  it('clear는 대기열을 비우고 정리를 부른다', () => {
    const { clock, advance } = fakeClock();
    const seq = createSequencer(clock);
    const log: string[] = [];
    seq.push(() => (log.push('a'), () => log.push('a-end')), 100);
    seq.push(() => void log.push('b'), 100);
    seq.clear();
    advance(500);
    expect(log).toEqual(['a', 'a-end']);
  });
});

describe('reveal 문구', () => {
  it('증감·별점', () => {
    expect(deltaText(20)).toBe('+20');
    expect(deltaText(-10)).toBe('-10');
    expect(deltaText(0)).toBe('0');
    expect(scoreText(-20, 3.5)).toBe('만족도 -20 → ★★★½ (3.5)');
  });
});
