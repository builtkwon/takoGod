import { describe, expect, it } from 'vitest';
import type { CustomerStatus, IngredientId } from '../../contracts';
import { difficulty } from '../levels';
import { customerEnteredAt, makePlate, playUntilLevel, setupV2, tickTo, type HoleSpec } from './helpers-v2';

/**
 * 난수 큐 rng. 큐가 비면 0.99를 돌려준다. 0.99는 모든 확률 판정에서 "해당 없음"이라 평범한 손님·접시가 나온다.
 * q는 영역 뽑기·대화 문항 선택·손님 입장을 뺀 난수 호출에서, sq는 손님 입장(spawn) 난수 호출에서 차례로 쓰인다.
 */
function queued() {
  const q: number[] = [];
  const sq: number[] = [];
  const rush: boolean[] = [];
  // 대화 문항 선택(pickLine)은 시각에 따라 끼어들므로 큐를 쓰지 않는다. 손님 입장(spawn) 난수는 sq에서, 그 밖은 q에서 읽는다.
  const h = setupV2({
    rng: () => {
      const stack = new Error().stack ?? '';
      if (stack.includes('pickLine')) return 0.99;
      return (stack.includes('GameV2.spawn') ? sq.shift() : q.shift()) ?? 0.99;
    },
  });
  h.bus.on('customer/entered', () => rush.push(h.game.state.rush !== null)); // 입장 때 러시 중이었는지
  return { h, q, sq, rush };
}


/** 비문어 재료 인덱스(난수 → 재료): 와사비 0, 생마늘 1, 지우개 2, 마시멜로 3, 고추 4. 난수 v는 floor(v × 5)다. */
const ING = { wasabi: 0, 'raw-garlic': 0.2, eraser: 0.4, marshmallow: 0.6, chili: 0.8 } as const;
/** 주문 개수 인덱스: 1 → 0, 3 → 0.4, 6 → 0.8(floor(v × 3)). */
const CNT = { 1: 0, 3: 0.4, 6: 0.8 } as const;

/** 테스트 전용: 게임 내부 상태를 직접 맞춘다(자연스러운 진행으로 만들기 어려운 경계 상황용). */
interface GameInternals {
  spawnTimer: number | null;
  guests: { avoid: string | null }[];
}
const internals = (h: ReturnType<typeof queued>['h']): GameInternals => h.game as unknown as GameInternals;

/**
 * level 단계에서 가게를 비우고, 첫 손님이 firstValues(성격, 인내, …) 난수로 입장하게 한다.
 * 손님은 단계를 넘어 남으므로 가게를 직접 비워(내부 상태) 이번 손님이 가장 먼저 서빙받게 한다.
 */
function startAt(h: ReturnType<typeof queued>['h'], sq: number[], level: number, firstValues: readonly number[]): CustomerStatus {
  playUntilLevel(h, level);
  clearShop(h);
  sq.push(...firstValues);
  tickTo(h, h.now + 0.1);
  return h.game.state.customers[0] as CustomerStatus;
}

/** 가게의 손님을 모두 내보내고 다음 입장을 바로 예약한다. */
function clearShop(h: ReturnType<typeof queued>['h']): void {
  const g = internals(h);
  g.guests.length = 0;
  g.spawnTimer = 0;
}

/** 구멍 0~5의 속재료: n개를 ingredient로, 나머지는 문어. */
const withIngredient = (ingredient: IngredientId, n: number): HoleSpec[] => Array.from({ length: 6 }, (_, i) => ({ filling: i < n ? ingredient : 'octopus' }));

describe('주문(GDD §주문, 10단계~)', () => {
  it('9단계까지는 주문 난수를 뽑지 않고 10단계부터 뽑는다', () => {
    const a = queued();
    startAt(a.h, a.sq, 9, [0, 0, 0.99]); // 성격, 인내, (9단계에는 주문 여부가 없다)
    expect(a.sq).toEqual([0.99]);
    const b = queued();
    startAt(b.h, b.sq, 10, [0, 0, 0.99]); // 성격, 인내, 주문 여부(0.99 → 없음)
    expect(b.sq).toEqual([]);
  });

  it('입장 난수 순서: 성격 → 인내 → 주문 여부 → 재료 → 개수. 주문은 입장 상태에 실린다', () => {
    const { h, sq } = queued();
    const c = startAt(h, sq, 10, [0, 0, 0, ING.eraser, CNT[3]]);
    expect(c.order).toEqual({ ingredient: 'eraser', count: 3 });
    expect(c.avoid).toBeNull();
    expect(c.group).toBeNull();
    expect(sq).toEqual([]);
    expect(h.of('customer/entered').at(-1)?.customer.order).toEqual({ ingredient: 'eraser', count: 3 });
  });

  it('성공: 주문 재료가 정확히 N개이고 나머지가 문어 → 만족도 +15(완벽 +20 포함 115), 가게 점수 +50은 배수 전 기본에 더한다', () => {
    const { h, sq } = queued();
    startAt(h, sq, 10, [0, 0, 0, ING.eraser, CNT[3]]);
    makePlate(h, withIngredient('eraser', 3));
    expect(h.of('order/resolved').at(-1)).toMatchObject({ success: true });
    expect(h.of('plate/tasted').at(-1)?.defects).toEqual([]); // 주문 재료는 함정이 아니다
    expect(h.of('plate/scored').at(-1)).toMatchObject({ delta: 35, stars: 5 });
    const e = h.of('score/plate').at(-1);
    expect(e?.points).toBe(Math.round((115 + 12 * 5 + 50) * (e?.multiplier ?? 1)));
  });

  it('실패(개수 부족): 만족도 -15, 가게 점수 보너스 없음, 완벽이 아니라 콤보가 끊긴다', () => {
    const { h, sq } = queued();
    startAt(h, sq, 10, [0, 0, 0, ING.eraser, CNT[3]]);
    makePlate(h, withIngredient('eraser', 2));
    expect(h.of('order/resolved').at(-1)).toMatchObject({ success: false });
    expect(h.of('plate/scored').at(-1)).toMatchObject({ delta: -15 });
    expect(h.of('score/plate').at(-1)).toMatchObject({ points: 65 + 60, combo: 0, multiplier: 1 });
  });

  it('주문 외 비문어 재료가 섞이면 기존 함정 -20도 접시당 한 번 더해진다', () => {
    const { h, sq } = queued();
    startAt(h, sq, 10, [0, 0, 0, ING.eraser, CNT[1]]);
    makePlate(h, [{ filling: 'eraser' }, { filling: 'wasabi' }, ...withIngredient('octopus', 4).slice(0, 4)]);
    expect(h.of('plate/tasted').at(-1)?.defects).toEqual(['trap']); // 와사비만 함정이다
    expect(h.of('plate/scored').at(-1)).toMatchObject({ delta: -35 }); // 함정 -20, 주문 실패 -15
  });

  it('모두(6)는 6개 전부가 주문 재료일 때 성공이다', () => {
    const { h, sq } = queued();
    startAt(h, sq, 10, [0, 0, 0, ING.marshmallow, CNT[6]]);
    makePlate(h, withIngredient('marshmallow', 6));
    expect(h.of('order/resolved').at(-1)).toMatchObject({ success: true });
  });

  it('속 없음 구멍이 있으면 실패다(문어가 아니다)', () => {
    const { h, sq } = queued();
    startAt(h, sq, 10, [0, 0, 0, ING.chili, CNT[1]]);
    makePlate(h, [{ filling: 'chili' }, { filling: 'none' }, ...withIngredient('octopus', 4).slice(0, 4)]);
    expect(h.of('order/resolved').at(-1)).toMatchObject({ success: false });
  });

  it('다시해줘 첫 접시에도 order/resolved를 내지만 점수·콤보는 더하지 않는다. 다시 받은 접시로 다시 판정한다', () => {
    const { h, q, sq } = queued();
    startAt(h, sq, 10, [0, 0, 0, ING.eraser, CNT[3]]);
    const scoreBefore = h.game.state.shopScore;
    const plates = h.of('score/plate').length;
    const hold = makePlate(h, [{ filling: 'none' }, { filling: 'wasabi' }, ...withIngredient('octopus', 4).slice(0, 4)], true);
    hold(() => q.push(0.1)); // 다시해줘 난수(첫 접시가 2.5★ 이하일 때 뽑는다)
    expect(h.of('customer/redo-requested')).toHaveLength(1);
    expect(h.of('order/resolved').at(-1)).toMatchObject({ success: false });
    expect(h.game.state.shopScore).toBe(scoreBefore);
    expect(h.of('score/plate')).toHaveLength(plates);
    makePlate(h, withIngredient('eraser', 3)); // 주문은 유지한 채 다시 받은 접시로 판정(첫 접시의 ±15는 취소)
    expect(h.of('order/resolved').at(-1)).toMatchObject({ success: true });
    expect(h.of('plate/scored').at(-1)).toMatchObject({ delta: 35 });
  });

  it('주문 확률은 10단계 40%에서 20단계 70%까지 선형이고 이후 고정, 10단계 전은 0이다', async () => {
    const { orderChance } = await import('../levels');
    expect([9, 10, 15, 20, 21, 50].map(orderChance)).toEqual([0, 0.4, 0.55, 0.7, 0.7, 0.7].map((x) => expect.closeTo(x, 9)));
  });
});

describe('식품 신고(GDD §점수)', () => {
  const trapPlate: HoleSpec[] = [{ filling: 'eraser' }, ...withIngredient('octopus', 5).slice(0, 5)];

  it('지우개가 든 접시는 3% 확률로 신고되어 별점이 1★ 깎인다(리뷰 코멘트 앞)', () => {
    const { h, q } = queued();
    playUntilLevel(h, 3);
    makePlate(h, trapPlate, true)(() => q.push(0.5, 0.02)); // 맛보기(함정) 1, 식품 신고 난수 0.02 < 0.03
    expect(h.of('plate/scored').at(-1)).toMatchObject({ stars: 3 }); // 80 - 20 = 60
    expect(h.of('plate/reported')).toEqual([{ customerId: expect.any(String), starsPenalty: 1 }]);
    expect(h.of('review/issued').at(-1)?.review.stars).toBe(2);
    const types = h.log.map((r) => r.type);
    expect(types.lastIndexOf('plate/reported')).toBeLessThan(types.lastIndexOf('review/issued'));
    expect(types.lastIndexOf('score/plate')).toBeLessThan(types.lastIndexOf('plate/reported'));
  });

  it('난수가 0.03 이상이면 신고되지 않는다(경계)', () => {
    const { h, q } = queued();
    playUntilLevel(h, 3);
    makePlate(h, trapPlate, true)(() => q.push(0.5, 0.03));
    expect(h.of('plate/reported')).toEqual([]);
    expect(h.of('review/issued').at(-1)?.review.stars).toBe(3);
  });

  it('지우개가 없는 접시는 신고 난수를 뽑지 않는다', () => {
    const { h, q } = queued();
    playUntilLevel(h, 3);
    makePlate(h, [{ filling: 'wasabi' }, ...withIngredient('octopus', 5).slice(0, 5)], true)(() => q.push(0.5, 0.0)); // 맛보기 1 + (뽑으면 신고될 0.0)
    expect(h.of('plate/reported')).toEqual([]);
    expect(h.of('review/issued').at(-1)?.review.stars).toBe(3);
  });

  it('다시해줘를 부른 첫 접시는 뽑지 않고, 다시 받은 접시는 뽑는다', () => {
    const { h, q } = queued();
    playUntilLevel(h, 3);
    const bad: HoleSpec[] = [{ filling: 'none' }, { filling: 'eraser' }, ...withIngredient('octopus', 4).slice(0, 4)];
    makePlate(h, bad, true)(() => q.push(0.1, 0.5, 0.5, 0.0)); // 다시해줘 0.1 → 요청, 맛보기 2, (뽑으면 신고될 0.0)
    expect(h.of('customer/redo-requested')).toHaveLength(1);
    expect(h.of('plate/reported')).toEqual([]);
    makePlate(h, trapPlate, true)(() => q.push(0.5, 0.0));
    expect(h.of('plate/reported')).toHaveLength(1);
  });

  it('별점 감점은 1★이고 최저 0.5★다. 이미 0.5★ 이하면 더 깎지도 올리지도 않는다', async () => {
    const { reportedStars } = await import('../scoring-v2');
    expect(reportedStars(0.5)).toEqual({ stars: 0.5, penalty: 0 });
    expect(reportedStars(1)).toEqual({ stars: 0.5, penalty: 0.5 });
    expect(reportedStars(0)).toEqual({ stars: 0, penalty: 0 });
    expect(reportedStars(3)).toEqual({ stars: 2, penalty: 1 });
  });
});

describe('빼 주세요(GDD §특별 손님, 13단계~)', () => {
  const avoidWasabi = [0, 0, 0.99, 0, ING.wasabi]; // 성격, 인내, 주문 없음, 빼 주세요 여부 0 < 0.2, 재료 와사비
  const wasabiPlate: HoleSpec[] = [{ filling: 'wasabi' }, ...withIngredient('octopus', 5).slice(0, 5)];

  it('주문이 없으면 5종 중, 있으면 주문 재료를 뺀 4종 중에서 뽑는다', () => {
    const a = queued();
    expect(startAt(a.h, a.sq, 13, avoidWasabi).avoid).toBe('wasabi');
    const b = queued();
    // 주문 와사비 1개, 빼 주세요 재료 인덱스 0은 4종(생마늘·지우개·마시멜로·고추)의 첫째다.
    const d = startAt(b.h, b.sq, 13, [0, 0, 0, ING.wasabi, CNT[1], 0, 0]);
    expect(d.order).toEqual({ ingredient: 'wasabi', count: 1 });
    expect(d.avoid).toBe('raw-garlic');
  });

  it('위반: 만족도 -40 하나, 그 재료의 함정 -20은 없고 인내 -20도 없다. 즉시 화나지만 서빙 뒤 떠나 화난 손님 수에 남지 않는다', () => {
    const { h, sq } = queued();
    const c = startAt(h, sq, 13, avoidWasabi);
    const fumedBefore = h.game.state.fumedCount;
    makePlate(h, wasabiPlate);
    expect(h.of('customer/allergy').at(-1)).toMatchObject({ customerId: c.id, ingredient: 'wasabi' });
    expect(h.of('plate/scored').at(-1)).toMatchObject({ delta: -40, stars: 2 });
    expect(h.of('customer/fumed').filter((e) => e.customerId === c.id)).toHaveLength(1);
    expect(h.game.state.fumedCount).toBe(fumedBefore);
    expect(h.game.state.customers.some((x) => x.id === c.id)).toBe(false);
    const faces = h.of('customer/patience-changed').filter((e) => e.customerId === c.id).map((e) => e.face);
    expect(faces).toEqual(['annoyed', 'angry']);
    const types = h.log.map((r) => r.type);
    expect(types.lastIndexOf('customer/allergy')).toBeGreaterThan(types.lastIndexOf('plate/tasted'));
    expect(types.lastIndexOf('customer/fumed')).toBeLessThan(types.lastIndexOf('plate/scored'));
  });

  it('위반 접시는 별점이 다시해줘 조건 이하여도 다시해줘를 부르지 않는다(난수도 뽑지 않는다). 리뷰는 발급된다', () => {
    const { h, q, sq } = queued();
    startAt(h, sq, 13, avoidWasabi);
    const hold = makePlate(h, wasabiPlate, true);
    // 모두 0이면 다시해줘(0 < 0.2)를 뽑았을 때 걸린다. 접시 난수는 맛보기 1 + 리뷰 코멘트 1 + 트레이 셔플 5 = 7개다.
    hold(() => q.push(...Array.from({ length: 8 }, () => 0)));
    expect(h.of('plate/scored').at(-1)).toMatchObject({ delta: -40, stars: 2 }); // 2.5★ 이하
    expect(h.of('customer/redo-requested')).toEqual([]);
    expect(h.of('review/issued').at(-1)?.review.stars).toBe(2);
    expect(h.of('customer/left').length).toBeGreaterThan(0);
    expect(q).toEqual([0]); // 다시해줘 난수를 뽑았다면 하나 더 줄었을 것이다
  });

  it('위반이 없는 접시는 별점이 2.5 이하이면 기존대로 다시해줘를 뽑는다', () => {
    const { h, q, sq } = queued();
    startAt(h, sq, 13, avoidWasabi);
    const hold = makePlate(h, [{ filling: 'none' }, { filling: 'chili' }, ...withIngredient('octopus', 4).slice(0, 4)], true); // 속 없음·함정 → 2.0★
    hold(() => q.push(0));
    expect(h.of('customer/allergy')).toEqual([]);
    expect(h.of('customer/redo-requested')).toHaveLength(1);
  });

  it('이미 화난 손님이면 -40만 적용하고 화난 연출 이벤트를 다시 내지 않는다', () => {
    const { h, sq } = queued();
    const c = startAt(h, sq, 13, avoidWasabi);
    const t = customerEnteredAt(h, h.of('customer/entered').length - 1);
    tickTo(h, t + 50); // 인내(약 42초)가 다 차서 화남(-20, 화난 손님 수 +1)
    expect(h.game.state.customers.find((x) => x.id === c.id)?.patience).toBe(1);
    makePlate(h, wasabiPlate);
    expect(h.of('customer/fumed').filter((e) => e.customerId === c.id)).toHaveLength(1);
    expect(h.of('customer/allergy').at(-1)).toMatchObject({ customerId: c.id });
  });

  it('접시에 그 재료가 없으면 기본 규칙대로 처리한다', () => {
    const { h, sq } = queued();
    startAt(h, sq, 13, avoidWasabi);
    makePlate(h);
    expect(h.of('customer/allergy')).toEqual([]);
    expect(h.of('plate/scored').at(-1)).toMatchObject({ delta: 20 });
  });

  it('다른 손님 3명이 화나 있어도 위반 손님은 서빙 뒤 떠나므로 판이 끝나지 않는다', () => {
    const { h, sq } = queued();
    playUntilLevel(h, 13);
    clearShop(h);
    // 손님1: 빼 주세요 와사비, 인내 큼. 손님2~4: 평범하고 인내 최소.
    sq.push(0, 0.99, 0.99, 0, ING.wasabi, ...[0, 0, 0.99, 0.99, 0, 0, 0.99, 0.99, 0, 0, 0.99, 0.99]);
    tickTo(h, h.now + 10);
    expect(h.game.state.customers.map((x) => x.avoid)).toEqual(['wasabi', null, null, null]);
    for (let i = 0; i < 2000 && h.game.state.fumedCount < 3; i++) h.tick(0.1);
    expect(h.game.state.fumedCount).toBe(3);
    expect(h.game.finished).toBe(false);
    makePlate(h, wasabiPlate); // 손님1에게 위반 → 화나지만 떠난다
    expect(h.of('customer/allergy')).toHaveLength(1);
    expect(h.game.finished).toBe(false);
    expect(h.of('session/game-over')).toEqual([]);
    expect(h.game.state.fumedCount).toBe(3);
  });

  it('단체 손님이 첫 접시 위반으로 화난 채 남아 가게 4명이 모두 화나면 접시 처리 직후 판이 끝난다', () => {
    const { h, sq } = queued();
    playUntilLevel(h, 15);
    clearShop(h);
    sq.push(0, 0.99, 0.99, 0, ING.wasabi, 0, ...[0, 0, 0.99, 0.99, 0.99, 0, 0, 0.99, 0.99, 0.99, 0, 0, 0.99, 0.99, 0.99]);
    tickTo(h, h.now + 10);
    expect(h.game.state.customers[0]?.group).not.toBeNull();
    for (let i = 0; i < 2000 && h.game.state.fumedCount < 3; i++) h.tick(0.1);
    expect(h.game.state.fumedCount).toBe(3);
    makePlate(h, wasabiPlate); // 단체 손님 첫 접시: 위반으로 화난 채 남는다
    expect(h.game.finished).toBe(true);
    expect(h.of('session/game-over')).toEqual([{ reason: 'fumed', fumedCount: 4 }]);
    const types = h.log.map((r) => r.type);
    const over = types.indexOf('session/game-over');
    expect(over).toBeGreaterThan(types.lastIndexOf('plate/scored'));
    expect(types.slice(over + 1).includes('customer/entered')).toBe(false);
  });
});

describe('러시 아워(GDD §특별 손님, 12단계~)', () => {
  const startRush = (h: ReturnType<typeof queued>['h']) => {
    for (let i = 0; i < 14 && h.of('rush/started').length === 0; i++) makePlate(h);
    expect(h.of('rush/started')).toHaveLength(1);
  };

  it('12단계 전에 넘은 가게 점수 경계는 소급하지 않는다', () => {
    const { h } = queued();
    playUntilLevel(h, 11);
    expect(h.game.state.shopScore).toBeGreaterThan(1000);
    expect(h.of('rush/started')).toEqual([]);
    expect(h.game.state.rush).toBeNull();
  });

  it('12단계 이상에서 점수가 1000의 배수 경계를 넘으면 30초 러시가 시작되고 시간이 줄어 끝난다', () => {
    const { h } = queued();
    playUntilLevel(h, 12);
    startRush(h);
    expect(h.of('rush/started')).toEqual([{ durationSec: 30 }]);
    expect(h.game.state.level).toBeGreaterThanOrEqual(12);
    const start = h.game.state.rush?.remainingSec ?? 0;
    expect(start).toBeGreaterThan(29);
    h.tick(10);
    expect(h.game.state.rush?.remainingSec).toBeCloseTo(start - 10, 6);
    expect(h.of('rush/ended')).toEqual([]);
    tickTo(h, h.now + 21);
    expect(h.game.state.rush).toBeNull();
    expect(h.of('rush/ended')).toEqual([{}]);
  });

  it('러시 중에는 입장 대기가 절반(3초 → 1.5초)이고 그 사이 입장한 손님의 인내는 ×1.5다', () => {
    const { h } = queued();
    playUntilLevel(h, 12);
    startRush(h);
    const level = h.game.state.level;
    clearShop(h);
    const from = h.log.length;
    tickTo(h, h.now + 4);
    const times = h.log.slice(from).filter((r) => r.type === 'customer/entered').map((r) => r.t);
    expect(times.length).toBeGreaterThanOrEqual(3);
    expect((times[1] ?? 0) - (times[0] ?? 0)).toBeLessThanOrEqual(1.6); // 일반 3초가 러시에는 1.5초
    // 인내는 레벨 범위에서 난수 0.99를 뽑은 값의 1.5배(대기열 큐는 비어 0.99).
    const d = difficulty(level);
    const total = (d.patienceMinSec + 0.99 * (d.patienceMaxSec - d.patienceMinSec)) * 1.5;
    const first = h.game.state.customers[0];
    expect(first?.patience).toBeCloseTo((h.now - (times[0] ?? 0)) / total, 2);
  });

  it('러시가 진행 중이면 다시 시작하지 않는다(rush/started 한 번)', () => {
    const { h } = queued();
    playUntilLevel(h, 12);
    startRush(h);
    const remaining = h.game.state.rush?.remainingSec ?? 0;
    h.tick(5);
    expect(h.of('rush/started')).toHaveLength(1);
    expect(h.game.state.rush?.remainingSec ?? 0).toBeLessThan(remaining);
  });

  it('판이 끝나면 러시도 끝난다', () => {
    const { h } = queued();
    playUntilLevel(h, 12);
    startRush(h);
    tickTo(h, h.now + 110); // 손님을 방치해 패배로 간다(러시는 이미 30초가 지나 끝났을 수 있다)
    for (let i = 0; i < 6 && !h.game.finished; i++) {
      tickTo(h, h.now + 110);
      if (!h.game.finished) makePlate(h);
    }
    expect(h.game.state.rush).toBeNull();
    if (h.of('rush/started').length > 0) expect(h.of('rush/ended').length).toBeGreaterThanOrEqual(1);
  });
});

describe('단체 주문(GDD §특별 손님, 15단계~)', () => {
  const groupValues = [0, 0, 0.99, 0.99, 0]; // 성격, 인내 최소, 주문 없음, 빼 주세요 없음, 단체 0 < 0.15

  it('15단계 주문 없는 손님이 단체로 입장하면 접시 2개를 받는다. 인내는 ×1.6이다', () => {
    const { h, sq, rush } = queued();
    const c = startAt(h, sq, 15, groupValues);
    expect(c.group).toEqual({ platesNeeded: 2, platesReceived: 0 });
    expect(c.order).toBeNull();
    const t = customerEnteredAt(h, h.of('customer/entered').length - 1);
    tickTo(h, t + 10);
    const min = 48 - (12 * 9) / 14; // 15단계 인내 하한
    const rushMult = rush.at(-1) ? 1.5 : 1; // 러시 아워 중에 입장했으면 ×1.5도 곱한다
    expect(h.game.state.customers[0]?.patience).toBeCloseTo(10 / (min * 1.6 * rushMult), 3);
  });

  it('첫 접시: 리뷰·퇴장 없이 다음 접시를 기다리고 목표 접시 수에 센다. 두 번째 접시에서 별점 평균 리뷰 하나로 퇴장한다', () => {
    const { h, sq } = queued();
    const c = startAt(h, sq, 15, groupValues);
    const reviews = h.of('review/issued').length;
    makePlate(h); // 완벽 5.0★
    expect(h.of('review/issued')).toHaveLength(reviews);
    expect(h.of('customer/left').some((e) => e.customerId === c.id)).toBe(false);
    expect(h.game.state.customers[0]?.group).toEqual({ platesNeeded: 2, platesReceived: 1 });
    expect(h.game.state.level).toBe(15);
    makePlate(h, [{ filling: 'none' }, ...withIngredient('octopus', 5).slice(0, 5)]); // 80 - 20 = 60 → 3.0★
    expect(h.of('plate/scored').slice(-2).map((e) => e.stars)).toEqual([5, 3]);
    expect(h.of('review/issued')).toHaveLength(reviews + 1);
    expect(h.of('review/issued').at(-1)?.review.stars).toBe(4);
    expect(h.of('customer/left').at(-1)).toEqual({ customerId: c.id });
    expect(h.game.state.level).toBe(16); // 목표 접시 2개를 두 접시로 채웠다
  });

  it('접시마다 가게 점수·콤보를 처리한다(score/plate 두 번)', () => {
    const { h, sq } = queued();
    startAt(h, sq, 15, groupValues);
    const n = h.of('score/plate').length;
    makePlate(h);
    makePlate(h);
    expect(h.of('score/plate')).toHaveLength(n + 2);
  });

  it('단체 손님에게는 다시해줘·0~1점 떠남을 판정하지 않는다', () => {
    const { h, q, sq } = queued();
    startAt(h, sq, 15, groupValues);
    makePlate(h);
    // 일반 손님이면 다시해줘(0 < 0.2)가 걸리는 난수를 모두 0으로 채운다.
    makePlate(h, [{ filling: 'none' }, { filling: 'wasabi' }, ...withIngredient('octopus', 4).slice(0, 4)], true)(() => q.push(...Array.from({ length: 14 }, () => 0)));
    expect(h.of('customer/redo-requested')).toEqual([]);
    expect(h.of('customer/walked-out')).toEqual([]);
  });

  it('남은 접시 목표와 무관하게 단체 손님이 입장한다(입장은 빈 자리 기준)', () => {
    const { h, sq } = queued();
    playUntilLevel(h, 15);
    makePlate(h); // 서빙한 접시 1, 남은 목표 1
    expect(h.game.state.level).toBe(15);
    clearShop(h);
    sq.push(...groupValues);
    tickTo(h, h.now + 0.1);
    expect(h.game.state.customers[0]?.group).toEqual({ platesNeeded: 2, platesReceived: 0 });
  });

  it('주문이 있으면 단체 난수를 뽑지 않는다', () => {
    const { h, sq } = queued();
    const c = startAt(h, sq, 15, [0, 0, 0, ING.eraser, CNT[1], 0.99, 0.99]); // 주문, 빼 주세요 없음, (단체 난수 없음), 남은 값
    expect(c.order).not.toBeNull();
    expect(c.group).toBeNull();
    expect(sq).toEqual([0.99]); // 15단계에는 VIP 난수(17단계~)도 없다: 마지막 값이 남는다
  });
});

describe('깐깐한 VIP(GDD §특별 손님, 17단계~)', () => {
  const vipValues = [0, 0, 0.99, 0.99, 0.99, 0]; // 성격, 인내 최소, 주문·빼 주세요·단체 없음, VIP 0 < 0.1

  it('17단계 손님이 VIP이면 인내가 ×0.7이다', () => {
    const { h, sq, rush } = queued();
    const c = startAt(h, sq, 17, vipValues);
    const rushAtEntry = rush.at(-1); // 이 손님 입장 때 러시 중이었는지(손님2 입장 전에 읽는다)
    expect(c.vip).toBe(true);
    const t = customerEnteredAt(h, h.of('customer/entered').length - 1);
    tickTo(h, t + 10);
    const min = 48 - (12 * 11) / 14;
    const rushMult = rushAtEntry ? 1.5 : 1;
    expect(h.game.state.customers[0]?.patience).toBeCloseTo(10 / (min * 0.7 * rushMult), 3);
  });

  it('완벽 접시는 접시 점수가 ×2(콤보 배수와 곱)이고 완벽이 아니면 ×1이다', () => {
    const { h, sq } = queued();
    startAt(h, sq, 17, vipValues);
    makePlate(h);
    const e = h.of('score/plate').at(-1);
    expect(e?.multiplier).toBeGreaterThanOrEqual(2);
    expect(e?.points).toBe(Math.round((100 + 12 * 5) * (e?.multiplier ?? 1)));
    const g = queued();
    startAt(g.h, g.sq, 17, vipValues);
    makePlate(g.h, { miss1: true });
    expect(g.h.of('score/plate').at(-1)).toMatchObject({ multiplier: 1, combo: 0 });
  });
});
