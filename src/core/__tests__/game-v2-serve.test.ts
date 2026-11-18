import { describe, expect, it } from 'vitest';
import type { Personality } from '../../contracts';
import { TRAY_SOURCE } from '../cooking';
import { syntheticDataV2 } from '../synthetic-data-v2';
import { makePlate, playUntilPhase, scripted, setupV2 } from './helpers-v2';

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
// 난수 값 → 성격(0..3)·인내시간(20 + v*20초)
const P = { salaryman: 0, grandma: 0.3, gourmet: 0.6, tourist: 0.9 } as const;

/** P2까지 진행한다(P1 접시는 서빙 없이 비운다). 이후 난수 소비는 P2 손님 입장(성격·인내)부터다. */
const toP2 = (h: ReturnType<typeof setupV2>) => playUntilPhase(h, 'P2');

describe('후네와 서빙', () => {
  it('손님 0명 페이즈(P1): 6개가 차면 서빙 없이 비우고 P2로 전환한다', () => {
    const h = setupV2();
    makePlate(h);
    expect(h.game.state.fune).toHaveLength(0);
    expect(h.game.state.phase).toBe('P2');
    expect(h.of('plate/tasted')).toEqual([]);
    expect(h.of('review/issued')).toEqual([]);
    expect(h.of('phase/changed').map((e) => e.phase)).toEqual(['P1', 'P2']);
    expect(h.of('fune/added').map((e) => e.count)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('6개가 차기 전에는 서빙하지 않는다', () => {
    const h = setupV2();
    toP2(h);
    const finish = makePlate(h, {}, true);
    expect(h.game.state.fune).toHaveLength(5);
    expect(h.of('plate/tasted')).toEqual([]);
    finish();
    expect(h.of('plate/tasted')).toHaveLength(1);
    expect(h.game.state.fune).toHaveLength(0);
  });

  it('서빙하면 후네만 비우고 철판에서 진행 중인 구멍은 그대로다', () => {
    const h = setupV2();
    toP2(h);
    const finish = makePlate(h, {}, true);
    // 이미 비워진 구멍 0~4에서 다음 접시를 시작한다.
    for (const i of [0, 1, 2, 3, 4]) h.place(i, { kind: 'margarine' });
    h.place(0, { kind: 'batter' });
    finish();
    expect(h.game.state.fune).toHaveLength(0);
    expect(h.hole(0).stage).toBe('cooking');
    expect(h.hole(1).stage).toBe('greased');
    expect(h.hole(5).stage).toBe('empty');
  });

  it('두 손님이 기다리면 가장 먼저 온 손님이 먼저 서빙된다(선착순)', () => {
    const h = setupV2();
    playUntilPhase(h, 'P3');
    h.tick(3.1); // 손님2 입장(3초 뒤)
    const [first, second] = h.game.state.customers;
    expect(h.game.state.customers).toHaveLength(2);
    makePlate(h);
    expect(h.of('customer/left').at(-1)).toEqual({ customerId: first?.id });
    expect(h.game.state.customers.map((c) => c.id)).toEqual([second?.id]);
  });

  it('손님이 서빙되고 나가면 후네는 비고 다음 손님은 2초 뒤 입장한다', () => {
    const h = setupV2();
    toP2(h);
    const entered = h.of('customer/entered').length;
    makePlate(h);
    expect(h.of('customer/left')).toHaveLength(1);
    expect(h.game.state.customers).toHaveLength(0);
    h.tick(1.9);
    expect(h.of('customer/entered')).toHaveLength(entered);
    h.tick(0.1);
    expect(h.of('customer/entered')).toHaveLength(entered + 1);
  });

  it('트레이는 서빙 시점에만 셔플된다(P1 비우기에는 셔플하지 않는다)', () => {
    const h = setupV2();
    expect(h.game.state.tray.map((t) => t.id)).toEqual(TRAY_SOURCE.map((t) => t.id));
    makePlate(h);
    expect(h.game.state.phase).toBe('P2');
    expect(h.game.state.tray.map((t) => t.id)).toEqual(TRAY_SOURCE.map((t) => t.id));
    const finish = makePlate(h, {}, true);
    expect(h.game.state.tray.map((t) => t.id)).toEqual(TRAY_SOURCE.map((t) => t.id));
    finish();
    const after = h.game.state.tray.map((t) => t.id);
    expect([...after].sort()).toEqual(TRAY_SOURCE.map((t) => t.id).sort());
    expect(after).not.toEqual(TRAY_SOURCE.map((t) => t.id)); // seed 1에서 순서가 바뀐다
  });

  it('P2 두 접시를 서빙하면 P3로 전환한다(리뷰 발급 접시 수 2)', () => {
    const h = setupV2();
    toP2(h);
    makePlate(h);
    expect(h.game.state.phase).toBe('P2');
    h.tick(2);
    makePlate(h);
    expect(h.game.state.phase).toBe('P3');
    expect(h.of('review/issued')).toHaveLength(2);
  });
});

describe('맛보기 반응·점수 공개 순서', () => {
  it('서빙 직후 plate/tasted → plate/scored → review/issued → customer/left 순서다', () => {
    const h = setupV2();
    toP2(h);
    const from = h.log.length;
    makePlate(h);
    const order = h.log.slice(from).map((r) => r.type).filter((t) => ['plate/tasted', 'plate/scored', 'review/issued', 'customer/left'].includes(t));
    expect(order).toEqual(['plate/tasted', 'plate/scored', 'review/issued', 'customer/left']);
  });

  it('점수 비공개: 진행 중 상태에는 만족도·점수 정보가 없다', () => {
    const h = setupV2();
    toP2(h);
    expect(JSON.stringify(h.game.state)).not.toMatch(/satisf/i);
    expect(h.game.state.customers[0]).not.toHaveProperty('satisfaction');
    expect(h.of('plate/scored')).toEqual([]);
  });

  it('결함이 없으면 완벽 대사 1개를 고른다(core가 고른다)', () => {
    // 난수 순서: 성격, 인내, [어두움 상한·다시해줘·떠남은 조건 불일치로 뽑지 않음], 맛보기, 코멘트
    const s = scripted([P.grandma, 0.5, 0.99, 0.0]);
    const h = setupV2({ rng: s.rng });
    toP2(h);
    makePlate(h);
    const tasted = h.of('plate/tasted')[0];
    expect(tasted?.defects).toEqual([]);
    expect(tasted?.lines).toEqual([{ defect: 'perfect', text: syntheticDataV2.tasteLines.grandma.perfect[1] }]);
    expect(h.of('review/issued')[0]?.review.comment).toBe(syntheticDataV2.reviewComments('grandma', 5)[0]);
  });

  it('결함 종류마다 성격당 대사 2개 중 하나를 고른다(결함 순서대로 난수 1개씩)', () => {
    // 속 없음 + 함정 + 굴리기 빗나감: 맛보기 난수 3개(0, 0.99, 0)
    const s = scripted([P.gourmet, 0.5, 0.99, 0.0, 0.99, 0.0, 0.0]);
    const h = setupV2({ rng: s.rng });
    toP2(h);
    makePlate(h, [{ filling: 'none', miss1: true }, { filling: 'wasabi' }]);
    const tasted = h.of('plate/tasted')[0];
    expect(tasted?.defects).toEqual(['no-filling', 'trap', 'roll-miss']);
    const t = syntheticDataV2.tasteLines.gourmet;
    expect(tasted?.lines).toEqual([
      { defect: 'no-filling', text: t['no-filling'][0] },
      { defect: 'trap', text: t.trap[1] },
      { defect: 'roll-miss', text: t['roll-miss'][0] },
    ]);
  });

  it('맛보기 대사 데이터가 비어 있으면 생성 시 던진다', () => {
    const empty = { ...syntheticDataV2, tasteLines: { ...syntheticDataV2.tasteLines, tourist: { ...syntheticDataV2.tasteLines.tourist, trap: [] } } };
    expect(() => setupV2({ data: empty })).toThrow(/tourist.*trap|trap.*tourist/);
  });

  it('모든 성격에서 대사를 고를 수 있다', () => {
    for (const p of PERSONALITIES) {
      const h = setupV2({ rng: scripted([P[p], 0.5]).rng });
      toP2(h);
      expect(h.game.state.customers[0]?.personality).toBe(p);
      makePlate(h);
      expect(h.of('plate/tasted')[0]?.lines[0]?.text).toContain(p);
    }
  });
});

describe('점수 계산(GDD §점수)', () => {
  const NO_REDO = [P.salaryman, 0.5]; // 이후는 fallback 0.99: 다시해줘 0.99 ≥ 0.2, 떠남 0.99 ≥ 0.15

  const serve = (specs: Parameters<typeof makePlate>[1], script: readonly number[] = NO_REDO) => {
    const h = setupV2({ rng: scripted(script).rng });
    toP2(h);
    makePlate(h, specs);
    const scored = h.of('plate/scored')[0];
    return { h, scored, review: h.of('review/issued')[0]?.review };
  };

  it('완벽 굽기 +20 → 만족도 100 → 5.0', () => {
    const { scored, review } = serve({});
    expect(scored).toMatchObject({ delta: 20, stars: 5 });
    expect(review).toMatchObject({ source: 'customer', stars: 5, personality: 'salaryman' });
  });

  it('굴리기 빗나감만 있으면 감점도 보너스도 없다(만족도 80 → 4.0)', () => {
    const { scored } = serve({ miss2: true });
    expect(scored).toMatchObject({ delta: 0, stars: 4 });
  });

  it('속 없음 -20 → 60 → 3.0 (속 없음 구멍이 여러 개여도 한 번)', () => {
    const { scored } = serve([{ filling: 'none' }, { filling: 'none' }]);
    expect(scored).toMatchObject({ delta: -20, stars: 3 });
  });

  it('함정 재료 -20 → 3.0 (여러 개여도 한 번)', () => {
    const { scored } = serve([{ filling: 'wasabi' }, { filling: 'chili' }, { filling: 'eraser' }]);
    expect(scored).toMatchObject({ delta: -20, stars: 3 });
  });

  it('속 없음과 함정은 각각 -20 → 40 → 2.0 (다시해줘 조건은 난수로 불발)', () => {
    const { scored, review } = serve([{ filling: 'none' }, { filling: 'wasabi' }]);
    expect(scored).toMatchObject({ delta: -40, stars: 2 });
    expect(review?.stars).toBe(2);
  });

  it('plate/scored는 어두워짐 상한 적용 뒤 별점이다', () => {
    // 난수: 성격, 인내, 상한(0 → 최솟값 3.5)
    const { scored, review } = serve([{ dark: true }], [P.salaryman, 0.5, 0.0]);
    expect(scored).toMatchObject({ delta: 0, stars: 3.5 });
    expect(review?.stars).toBe(3.5);
  });
});

describe('어두워짐 별점 상한(개수별 범위에서 0.5 단위 무작위)', () => {
  const darkSpecs = (n: number) => Array.from({ length: n }, () => ({ dark: true }));
  // 어두운 접시는 완벽이 아니므로 기본 별점 4.0. 상한 뽑기 값 0 → 최솟값, 0.99 → 최댓값.
  it.each([
    [1, 3.5, 4],
    [2, 3, 3.5],
    [3, 3, 3.5],
    [4, 2.5, 3],
    [5, 2.5, 3],
    [6, 2, 2.5],
  ] as const)('어두운 %i개 → %f~%f', (n, min, max) => {
    for (const [draw, expected] of [
      [0.0, min],
      [0.99, max],
    ] as const) {
      const h = setupV2({ rng: scripted([P.salaryman, 0.5, draw]).rng });
      toP2(h);
      makePlate(h, darkSpecs(n));
      expect(h.of('plate/scored')[0]?.stars).toBe(expected);
      expect(h.of('plate/tasted')[0]?.defects).toContain('dark');
    }
  });

  it('기존 별점이 상한보다 낮으면 그대로다(min)', () => {
    // 속 없음 + 함정(40 → 2.0) + 어두움 1개(상한 3.5~4.0) → 2.0
    const h = setupV2({ rng: scripted([P.salaryman, 0.5, 0.0]).rng });
    toP2(h);
    makePlate(h, [{ filling: 'none', dark: true }, { filling: 'wasabi' }]);
    expect(h.of('plate/scored')[0]?.stars).toBe(2);
  });

  it('어두워진 구멍이 없으면 상한 난수를 뽑지 않는다', () => {
    const s = scripted([P.salaryman, 0.5]);
    const h = setupV2({ rng: s.rng });
    toP2(h);
    const before = s.used();
    makePlate(h);
    // 맛보기 1 + 코멘트 1 + 트레이 셔플 5
    expect(s.used() - before).toBe(7);
  });

  it('어두워진 구멍이 있으면 상한 난수 1개를 더 뽑는다', () => {
    const s = scripted([P.salaryman, 0.5, 0.0]);
    const h = setupV2({ rng: s.rng });
    toP2(h);
    const before = s.used();
    makePlate(h, [{ dark: true }]);
    expect(s.used() - before).toBe(8);
  });
});
