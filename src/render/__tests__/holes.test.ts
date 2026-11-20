import { describe, expect, it } from 'vitest';
import type { HoleStage, HoleStateV2, PatienceLevel } from '../../contracts';
import { BLINK_MS, FACE_TINT, RIM_COLOR, holeTint, rimOf, rimVisible, showsFilling, showsNoFilling } from '../holes';
import { DOUGH_LOOKS, bakeTint } from '../models';

const STAGES: HoleStage[] = ['empty', 'greased', 'cooking', 'cooked', 'filled', 'rolled', 'done', 'dark', 'burnt'];
const h = (stage: HoleStage, o: Partial<HoleStateV2> = {}): HoleStateV2 => ({
  index: 0,
  stage,
  cookElapsedSec: 0,
  burnElapsedSec: 0,
  filling: null,
  noFilling: false,
  rollHits: [null, null],
  rollZone: null,
  warn: false,
  locked: false,
  ...o,
});
const lum = (t: readonly number[]) => t[0]! + t[1]! + t[2]!;

describe('구멍 9단계 모양', () => {
  it('완성·어두움·탄 것은 같은 모양이고 색조만 다르다', () => {
    expect(DOUGH_LOOKS.dark).toEqual(DOUGH_LOOKS.done);
    expect(DOUGH_LOOKS.burnt).toEqual(DOUGH_LOOKS.done);
    expect(lum(holeTint(h('done')))).toBeGreaterThan(lum(holeTint(h('dark'))));
    expect(holeTint(h('dark'))).toEqual(bakeTint('dark'));
    expect(holeTint(h('burnt'))).toEqual(bakeTint('burnt'));
  });
  it('익힘은 경과가 오를수록 어두워진다', () => {
    expect(lum(holeTint(h('cooking', { cookElapsedSec: 3 })))).toBeLessThan(lum(holeTint(h('cooking', { cookElapsedSec: 0 }))));
  });
  it('속재료 모델은 속재료 후(filled)에만 보인다', () => {
    for (const s of STAGES) expect(showsFilling(h(s, { filling: 'octopus' }))).toBe(s === 'filled');
    expect(showsFilling(h('filled'))).toBe(false);
  });
  it('속 없음 표시는 noFilling이고 굴림 이후 단계일 때만 보인다', () => {
    for (const s of STAGES) expect(showsNoFilling(h(s, { noFilling: true }))).toBe(['rolled', 'done', 'dark', 'burnt'].includes(s));
    expect(showsNoFilling(h('done'))).toBe(false);
  });
});

describe('테두리', () => {
  it('익힘 완료 초록, 완성 흰색, 어두움 주황이고 나머지는 없다', () => {
    expect(rimOf(h('cooked'))).toBe('cooked');
    expect(RIM_COLOR.cooked[1]).toBeGreaterThan(RIM_COLOR.cooked[0]);
    expect(RIM_COLOR.done).toEqual([1, 1, 1]);
    expect(RIM_COLOR.dark[0]).toBeGreaterThan(RIM_COLOR.dark[2]);
    expect(STAGES.filter((s) => rimOf(h(s)) !== null)).toEqual(['cooked', 'done', 'dark']);
  });
  it('warn이 아니면 항상 보이고, warn이면 반주기마다 번갈아 깜빡인다', () => {
    for (const t of [0, 100, BLINK_MS, 3 * BLINK_MS + 1]) expect(rimVisible(h('done'), t)).toBe(true);
    expect(rimVisible(h('done', { warn: true }), 0)).toBe(true);
    expect(rimVisible(h('done', { warn: true }), BLINK_MS)).toBe(false);
    expect(rimVisible(h('done', { warn: true }), 2 * BLINK_MS)).toBe(true);
  });
  it('테두리가 없는 단계는 warn이어도 안 보인다', () => {
    expect(rimVisible(h('cooking', { warn: true }), 0)).toBe(false);
  });
});

describe('손님 얼굴', () => {
  it('기본은 무색조, 주황은 파랑이 줄고, 빨강은 초록·파랑이 더 준다', () => {
    const f = (l: PatienceLevel) => FACE_TINT[l];
    expect(f('normal')).toEqual([1, 1, 1]);
    expect(f('annoyed')[2]).toBeLessThan(f('annoyed')[1]);
    expect(f('angry')[1]).toBeLessThan(f('annoyed')[1]);
    expect(f('angry')[2]).toBeLessThan(f('annoyed')[2]);
  });
});
