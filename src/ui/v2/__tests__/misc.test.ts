import { describe, expect, it } from 'vitest';
import { arrowGeometry, tutorialArrow } from '../arrow';
import { barView } from '../bar';
import { createSequencer, type Clock } from '../sequencer';
import { deltaText, scoreText } from '../reveal';
import { stateOf, stubPicker } from './helpers';
import { hudView } from '../hud';
import { iconPixels } from '../icons';
import { starFills, starsLabel } from '../stars';
import { LABEL_OFFSET_Y, trayLabelPlan } from '../tray-labels';

describe('barView', () => {
  it('두 영역을 퍼센트로 동시에, null인 쪽은 null', () => {
    const s = stateOf(['filled'], { barPosition: 0.25, barZones: { w1: { from: 0.4, to: 0.6 }, w2: null, shared: true } });
    expect(barView(s)).toEqual({ markerPct: 25, w1: { leftPct: 40, widthPct: 20 }, w2: null, shared: true });
    const both = stateOf(['filled'], { barZones: { w1: { from: 0.1, to: 0.4 }, w2: { from: 0.5, to: 0.7 }, shared: false } });
    expect(barView(both).w2).toEqual({ leftPct: 50, widthPct: 20 });
  });
  it('영역 없음·범위 밖·NaN', () => {
    const s = stateOf(['done'], { barPosition: Number.NaN });
    expect(barView(s)).toEqual({ markerPct: 0, w1: null, w2: null, shared: false });
    expect(barView(stateOf([], { barPosition: 2 })).markerPct).toBe(100);
  });
});

describe('별 칸', () => {
  it('0.5 단위 반 칸, 범위 밖·NaN은 자름', () => {
    expect(starFills(4.5)).toEqual(['full', 'full', 'full', 'full', 'half']);
    expect(starFills(0)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
    expect(starFills(4.7)).toEqual(['full', 'full', 'full', 'full', 'half']);
    expect(starFills(9)).toEqual(Array(5).fill('full'));
    expect(starFills(Number.NaN)).toEqual(Array(5).fill('empty'));
  });
  it('접근성 문구에 숫자를 남긴다', () => {
    expect(starsLabel(4.5)).toBe('별점 4.5점');
  });
});

describe('tutorialArrow', () => {
  const buckets = { margarine: () => ({ x: 5, y: 5 }), batter: () => ({ x: 395, y: 5 }) };
  it('마가린: 통 → 빈 첫 구멍', () => {
    const s = stateOf(['greased', 'empty']);
    expect(tutorialArrow('margarine', s, stubPicker(), buckets)).toEqual({ from: { x: 5, y: 5 }, to: { x: 150, y: 150 } });
  });
  it('잠긴 구멍은 가리키지 않는다', () => {
    const s = stateOf(['empty', 'empty']);
    const locked = { ...s, holes: [{ ...s.holes[0]!, locked: true }, s.holes[1]!] };
    expect(tutorialArrow('margarine', locked, stubPicker(), buckets)?.to).toEqual({ x: 150, y: 150 });
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
    expect(scoreText(-20)).toBe('만족도 -20');
  });
});

describe('트레이 이름표', () => {
  it('칸 앵커 아래에 재료 이름, 앵커 없는 칸은 null, 섞이면 따라간다', () => {
    const tray = [{ id: 'octopus', isTrap: false }, { id: 'wasabi', isTrap: true }, { id: 'chili', isTrap: true }] as const;
    expect(trayLabelPlan(tray, stubPicker())).toEqual([
      { text: '문어', at: { x: 50, y: 350 + LABEL_OFFSET_Y } },
      { text: '와사비', at: { x: 150, y: 350 + LABEL_OFFSET_Y + 14 } },
      null,
    ]);
    expect(trayLabelPlan([tray[1], tray[0]], stubPicker()).map((l) => l?.text)).toEqual(['와사비', '문어']);
  });
});

describe('고스트 아이콘', () => {
  it('속재료 6종·통·완성품 모두 그림이 있다', () => {
    for (const ingredient of ['octopus', 'wasabi', 'raw-garlic', 'eraser', 'marshmallow', 'chili'] as const) {
      expect(iconPixels({ kind: 'filling', ingredient }).length).toBeGreaterThan(0);
    }
    for (const kind of ['margarine', 'batter', 'done', 'dark', 'burnt'] as const) expect(iconPixels({ kind }).length).toBeGreaterThan(0);
  });
});

describe('hudView', () => {
  it('최고 기록이 없으면 "최고 -", 0점은 NEW가 아니고 0 초과면 NEW', () => {
    expect(hudView(stateOf([], { shopScore: 0 }))).toMatchObject({ best: '최고 -', isNew: false, score: '0' });
    expect(hudView(stateOf([], { shopScore: 10 })).isNew).toBe(true);
  });
  it('기록이 있으면 넘었을 때만 NEW(같으면 아님), 단계·리뷰 수 표시', () => {
    const s = stateOf([], { bestShopScore: 300, shopScore: 300, phase: 'main', level: 2 });
    expect(hudView(s)).toMatchObject({ best: '최고 300', isNew: false, phase: '2단계', reviews: '리뷰 0' });
    expect(hudView({ ...s, shopScore: 301 }).isNew).toBe(true);
  });
});

describe('hudView 단계·화난 손님', () => {
  it('튜토리얼에서는 화난 손님 표시를 숨기고 본게임에서는 보인다', () => {
    expect(hudView(stateOf([], { phase: 'tutorial', level: 0 })).fumedHidden).toBe(true);
    expect(hudView(stateOf([], { phase: 'main', level: 1 })).fumedHidden).toBe(false);
  });
  it('튜토리얼은 튜토리얼, 본게임은 level 단계(20 이후도 계속)', () => {
    expect(hudView(stateOf([], { phase: 'tutorial', level: 0 })).phase).toBe('튜토리얼');
    expect(hudView(stateOf([], { level: 1 })).phase).toBe('1단계');
    expect(hudView(stateOf([], { level: 37 })).phase).toBe('37단계');
  });
  it('화난 손님은 fumedLimit를 그대로 쓰고(하드코딩 아님) 0명이면 흐린 상태 값', () => {
    expect(hudView(stateOf([], { fumedCount: 0, fumedLimit: 4 }))).toMatchObject({ fumed: '😠 0/4', fumedCount: 0 });
    expect(hudView(stateOf([], { fumedCount: 3, fumedLimit: 5 }))).toMatchObject({ fumed: '😠 3/5', fumedCount: 3 });
  });
});
