import { describe, expect, it } from 'vitest';
import { syntheticDataV2 } from '../synthetic-data-v2';
import { controlled, customerEnteredAt, makePlate, playUntilLevel, scripted, setupV2, tickTo, type H } from './helpers-v2';

const SAL = 0; // 성격 난수 값: salaryman
const toP2 = (h: H) => playUntilLevel(h, 2);

describe('손님 입장 난수 순서와 인내(GDD §손님 대화)', () => {
  it('입장 시 성격 → 인내 시간 순서로 뽑는다', () => {
    const a = setupV2({ rng: scripted([0.9, 0]).rng }); // 관광객, 48초
    toP2(a);
    expect(a.game.state.customers[0]?.personality).toBe('tourist');
    a.tick(10);
    expect(a.game.state.customers[0]?.patience).toBeCloseTo(10 / 48);

    const b = setupV2({ rng: scripted([0, 0.5]).rng }); // 직장인, 72초
    toP2(b);
    expect(b.game.state.customers[0]?.personality).toBe('salaryman');
    b.tick(10);
    expect(b.game.state.customers[0]?.patience).toBeCloseTo(10 / 72);
  });

  it.each([
    [0, 48],
    [0.5, 72],
    [0.999, 95.95],
  ] as const)('인내 시간은 48~96초: 난수 %f → %f초', (v, total) => {
    const h = setupV2({ rng: scripted([SAL, v]).rng });
    toP2(h);
    h.tick(10);
    expect(h.game.state.customers[0]?.patience).toBeCloseTo(10 / total, 4);
  });

  it('입장 이벤트에 공개 상태가 담긴다(만족도 없음)', () => {
    const h = setupV2({ rng: scripted([SAL, 0]).rng });
    toP2(h);
    expect(h.of('customer/entered')).toEqual([
      { customer: {
          id: expect.any(String),
          personality: 'salaryman',
          dialogueIntervalSec: 12,
          patience: 0,
          face: 'normal',
          awaitingRedo: false,
          order: null,
          avoid: null,
          group: null,
          vip: false,
        } },
    ]);
  });

  it('얼굴이 기본 → 주황(50%) → 빨강(80%)으로 한 번씩 바뀌고 되돌아가지 않는다', () => {
    const h = setupV2({ rng: scripted([SAL, 0]).rng }); // 48초
    toP2(h);
    const t0 = customerEnteredAt(h);
    const id = h.game.state.customers[0]?.id;
    tickTo(h, t0 + 23.9);
    expect(h.of('customer/patience-changed')).toEqual([]);
    expect(h.game.state.customers[0]?.face).toBe('normal');
    tickTo(h, t0 + 24);
    expect(h.of('customer/patience-changed')).toEqual([{ customerId: id, face: 'annoyed' }]);
    tickTo(h, t0 + 38.3);
    expect(h.game.state.customers[0]?.face).toBe('annoyed');
    tickTo(h, t0 + 38.4);
    expect(h.of('customer/patience-changed')).toEqual([
      { customerId: id, face: 'annoyed' },
      { customerId: id, face: 'angry' },
    ]);
    tickTo(h, t0 + 90);
    expect(h.game.state.customers[0]?.face).toBe('angry');
    expect(h.game.state.customers[0]?.patience).toBe(1);
    expect(h.of('customer/patience-changed')).toHaveLength(2);
  });

  it('인내 100%가 되어도 손님은 떠나지 않는다', () => {
    const h = setupV2({ rng: scripted([SAL, 0]).rng });
    toP2(h);
    h.tick(100);
    expect(h.game.state.customers).toHaveLength(1);
    expect(h.of('customer/left')).toEqual([]);
  });

  it('인내 100%에 도달하면 customer/fumed를 그 손님에게 한 번만 낸다(떠나지 않음)', () => {
    const h = setupV2({ rng: scripted([SAL, 0]).rng }); // 48초
    toP2(h);
    const t0 = customerEnteredAt(h);
    const id = h.game.state.customers[0]?.id;
    tickTo(h, t0 + 47.9);
    expect(h.of('customer/fumed')).toEqual([]);
    tickTo(h, t0 + 48);
    expect(h.of('customer/fumed')).toEqual([{ customerId: id }]);
    h.tick(60);
    expect(h.of('customer/fumed')).toHaveLength(1);
    expect(h.of('customer/left')).toEqual([]);
  });

  it('인내 100% -20은 한 번만 적용된다(손님 입장 기준으로 시작)', () => {
    // 직장인·48초. 12·24·36초 대화에 좋은 답 세 번(+30), 48초 인내 -20(+10), 49초에 완벽 접시 +20 → delta +30(5★).
    // 인내 -20이 두 번 적용되면 delta +10.
    const h = setupV2({ rng: scripted([SAL, 0]).rng });
    toP2(h);
    const t0 = customerEnteredAt(h);
    const finish = makePlate(h, {}, true);
    tickTo(h, t0 + 12.05);
    const d = h.game.state.activeDialogues[0];
    expect(d).toBeDefined();
    h.answer(d?.customerId ?? '', 'good');
    tickTo(h, t0 + 24.1);
    h.answer(h.game.state.activeDialogues[0]?.customerId ?? '', 'good');
    tickTo(h, t0 + 36.1);
    h.answer(h.game.state.activeDialogues[0]?.customerId ?? '', 'good');
    tickTo(h, t0 + 49);
    finish();
    expect(h.of('plate/scored')[0]).toMatchObject({ delta: 30, stars: 5 });
  });

  it('손님 입장 시각부터 센다(P2 첫 손님은 페이즈 시작 직후)', () => {
    const h = setupV2({ rng: scripted([SAL, 0]).rng });
    toP2(h);
    expect(h.game.state.customers[0]?.patience).toBe(0);
  });
});

describe('대화(GDD §손님 대화)', () => {
  // 직장인·20초. 12초에 대화가 열린다. 좋은 답 +10, 나쁜 답 -10, 시간초과 -10. 굴리기 빗나감 접시는 만족도 변화 0이다.
  const withDialogue = (act: (h: H, customerId: string) => void) => {
    const h = setupV2({ rng: scripted([SAL, 0.5]).rng });
    toP2(h);
    const t0 = customerEnteredAt(h);
    const finish = makePlate(h, { miss2: true }, true);
    tickTo(h, t0 + 12.05);
    const d = h.game.state.activeDialogues[0];
    expect(d?.remainingSec).toBeLessThanOrEqual(5);
    act(h, d?.customerId ?? '');
    finish();
    return h;
  };

  it('좋은 답 +10', () => {
    const h = withDialogue((x, id) => x.answer(id, 'good'));
    expect(h.of('dialogue/resolved')).toEqual([{ customerId: expect.any(String), outcome: 'good' }]);
    expect(h.of('plate/scored')[0]).toMatchObject({ delta: 10, stars: 4.5 });
  });

  it('나쁜 답 -10', () => {
    const h = withDialogue((x, id) => x.answer(id, 'bad'));
    expect(h.of('plate/scored')[0]).toMatchObject({ delta: -10, stars: 3.5 });
  });

  it('5초 안에 답하지 않으면 시간초과 -10', () => {
    const h = withDialogue((x) => tickTo(x, x.now + 5));
    expect(h.of('dialogue/resolved')).toEqual([{ customerId: expect.any(String), outcome: 'timeout' }]);
    expect(h.of('plate/scored')[0]).toMatchObject({ delta: -10, stars: 3.5 });
  });

  it('대화가 닫히면 간격만큼 뒤에 다시 열린다', () => {
    const h = setupV2({ rng: scripted([SAL, 0.99]).rng });
    toP2(h);
    h.tick(12.01);
    expect(h.of('dialogue/started')).toHaveLength(1);
    h.tick(5);
    expect(h.of('dialogue/resolved')).toHaveLength(1);
    h.tick(11.9);
    expect(h.of('dialogue/started')).toHaveLength(1);
    h.tick(0.2);
    expect(h.of('dialogue/started')).toHaveLength(2);
  });

  it('성격 안에서 문항은 모두 쓰기 전까지 반복하지 않는다', () => {
    const h = setupV2({ rng: scripted([SAL, 0.99]).rng, data: syntheticDataV2 });
    toP2(h);
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      h.tick(12.01);
      seen.add(h.of('dialogue/started')[i]?.line.prompt ?? '');
      h.tick(5);
    }
    expect(seen.size).toBe(10);
  });
});

describe('다시해줘(별점 2.5 이하 20%, 1회)', () => {
  const BAD = [{ filling: 'none' as const }, { filling: 'wasabi' as const }]; // 80 → 40 → 2.0★
  const serveBad = (script: readonly number[], fallback = 0.99) => {
    const h = setupV2({ rng: scripted(script, fallback).rng });
    toP2(h);
    makePlate(h, BAD);
    return h;
  };

  it('난수가 20% 미만이면 요청한다: 리뷰·퇴장 없이 손님이 남고 후네만 비운다', () => {
    const h = serveBad([SAL, 0.5, 0.1]);
    expect(h.of('customer/redo-requested')).toEqual([{ customerId: h.game.state.customers[0]?.id }]);
    expect(h.of('review/issued')).toEqual([]);
    expect(h.of('customer/left')).toEqual([]);
    expect(h.game.state.reviews).toHaveLength(1); // 튜토리얼 리뷰뿐
    expect(h.game.state.customers[0]?.awaitingRedo).toBe(true);
    expect(h.game.state.fune).toHaveLength(0);
    expect(h.game.state.level).toBe(2);
  });

  it('요청해도 plate/tasted → plate/scored를 먼저 낸다(점수 공개)', () => {
    const h = serveBad([SAL, 0.5, 0.1]);
    const order = h.log.map((r) => r.type).filter((t) => ['plate/tasted', 'plate/scored', 'customer/redo-requested'].includes(t));
    expect(order).toEqual(['plate/tasted', 'plate/scored', 'customer/redo-requested']);
    expect(h.of('plate/scored')[0]).toMatchObject({ delta: -40, stars: 2 });
  });

  it('난수가 20% 이상이면 요청하지 않는다(경계 0.2)', () => {
    const h = serveBad([SAL, 0.5, 0.2]);
    expect(h.of('customer/redo-requested')).toEqual([]);
    expect(h.of('review/issued')).toHaveLength(1);
  });

  it('별점 2.5는 대상이고 3.0은 아니다(난수를 뽑는지로 확인)', () => {
    // 어두운 6개: 상한 2.0~2.5. 상한 난수 0.99 → 2.5★ → 다시해줘 난수 0.1 → 요청
    const a = setupV2({ rng: scripted([SAL, 0.5, 0.99, 0.1]).rng });
    toP2(a);
    makePlate(a, Array.from({ length: 6 }, () => ({ dark: true })));
    expect(a.of('plate/scored')[0]?.stars).toBe(2.5);
    expect(a.of('customer/redo-requested')).toHaveLength(1);
    // 어두운 4개: 상한 2.5~3.0. 상한 난수 0.99 → 3.0★ → 다시해줘 난수를 뽑지 않으므로 0.1은 맛보기에 쓰인다
    const b = setupV2({ rng: scripted([SAL, 0.5, 0.99, 0.1]).rng });
    toP2(b);
    makePlate(b, Array.from({ length: 4 }, () => ({ dark: true })));
    expect(b.of('plate/scored')[0]?.stars).toBe(3);
    expect(b.of('customer/redo-requested')).toEqual([]);
  });

  it('난수 순서: 상한 → 다시해줘 → 맛보기 (조건이 맞지 않는 항목은 뽑지 않는다)', () => {
    // 어두운 6개 → 상한 0 → 2.0★, 다시해줘 0.99(불발), 떠남은 2.0 > 1.5라 뽑지 않음, 맛보기(어두움) 0 → 대사 0, 코멘트 0.99 → 마지막
    const h = setupV2({ rng: scripted([SAL, 0.5, 0.0, 0.99, 0.0, 0.99]).rng });
    toP2(h);
    makePlate(h, Array.from({ length: 6 }, () => ({ dark: true })));
    expect(h.of('plate/scored')[0]?.stars).toBe(2);
    expect(h.of('plate/tasted')[0]?.lines).toEqual([{ defect: 'dark', text: syntheticDataV2.tasteLines.salaryman.dark[0] }]);
    expect(h.of('review/issued')[0]?.review.comment).toBe(syntheticDataV2.reviewComments('salaryman', 2)[2]);
  });

  it('손님 1명당 1회: 다시 받은 접시가 또 2.5 이하여도 요청하지 않고 리뷰를 낸다', () => {
    // 이후 난수는 모두 0(뽑았다면 다시해줘 0.0 < 0.2로 걸린다)
    const h = serveBad([SAL, 0.5, 0.1], 0);
    expect(h.of('customer/redo-requested')).toHaveLength(1);
    makePlate(h, BAD);
    expect(h.of('customer/redo-requested')).toHaveLength(1);
    expect(h.of('review/issued')).toHaveLength(1);
    expect(h.of('review/issued')[0]?.review.stars).toBe(2);
    expect(h.of('customer/left')).toHaveLength(1);
  });

  it('재계산: 첫 접시의 접시 증감은 취소하고 다시 받은 접시 기준으로 계산한다', () => {
    const h = serveBad([SAL, 0.5, 0.1]);
    makePlate(h); // 완벽 +20 → 80+20 = 100
    expect(h.of('plate/scored')[1]).toMatchObject({ delta: 20, stars: 5 });
    expect(h.of('review/issued')[0]?.review.stars).toBe(5);
    expect(h.game.state.reviews).toHaveLength(2); // 튜토리얼 5★ + 이 리뷰
  });

  it('재계산: 첫 접시의 어두워짐 상한도 취소한다', () => {
    // 어두운 6개(상한 2.5 → 다시해줘) 뒤 완벽 접시는 상한 없이 5.0★
    const h = setupV2({ rng: scripted([SAL, 0.5, 0.99, 0.1]).rng });
    toP2(h);
    makePlate(h, Array.from({ length: 6 }, () => ({ dark: true })));
    expect(h.of('customer/redo-requested')).toHaveLength(1);
    makePlate(h);
    expect(h.of('review/issued')[0]?.review.stars).toBe(5);
  });

  it('재계산: 첫 접시 뒤의 대화 증감은 유지한다', () => {
    const h = serveBad([SAL, 0.5, 0.1]);
    const t0 = customerEnteredAt(h);
    tickTo(h, t0 + 12.05);
    const d = h.game.state.activeDialogues[0];
    h.answer(d?.customerId ?? '', 'bad'); // 80 - 10 = 70
    makePlate(h, { miss2: true }); // 변화 0 → 70
    expect(h.of('plate/scored')[1]).toMatchObject({ delta: -10, stars: 3.5 });
  });

  // 요청한 손님은 항상 맨 앞이라 선착순과 결과가 같다: 선착순과 구분할 수 없고, 요청자에게 다시 서빙되는 흐름만 확인한다.
  it('요청 손님에게 다시 서빙', () => {
    const c = controlled();
    const h = setupV2({ rng: c.rng });
    playUntilLevel(h, 3);
    h.tick(3.1); // 손님2 입장
    const [first, second] = h.game.state.customers;
    const finish = makePlate(h, BAD, true);
    c.set(0.1);
    finish();
    c.set(null);
    expect(h.of('customer/redo-requested').at(-1)).toEqual({ customerId: first?.id });
    // 요청한 손님1을 건너뛰고 손님2에게 가면 안 된다. 손님1을 위해 완벽 접시를 내면 손님1이 나간다.
    makePlate(h);
    expect(h.of('customer/left').at(-1)).toEqual({ customerId: first?.id });
    expect(h.game.state.customers.map((x) => x.id)).toContain(second?.id);
  });
});

describe('0~1점 떠남(별점 1.5 이하이고 다시해줘가 아닐 때 15%)', () => {
  // 직장인·30초. 기본(late): 12초·24초 대화에 나쁜 답 두 번(-20 → 60), 28초 서빙: 접시 -40 → 20 → 1.0★.
  // early: 12초 대화에 나쁜 답(-10 → 70), 22초 서빙: 접시 -40 → 30 → 1.5★.
  const walk = (script: readonly number[], bad: readonly { filling: 'none' | 'wasabi' }[] = [{ filling: 'none' }, { filling: 'wasabi' }], early = false) => {
    const h = setupV2({ rng: scripted(script).rng });
    toP2(h);
    const t0 = customerEnteredAt(h);
    const finish = makePlate(h, bad, true);
    tickTo(h, t0 + 12.05);
    h.answer(h.game.state.activeDialogues[0]?.customerId ?? '', 'bad');
    if (!early) {
      tickTo(h, t0 + 24.1);
      h.answer(h.game.state.activeDialogues[0]?.customerId ?? '', 'bad');
    }
    tickTo(h, t0 + (early ? 22 : 28));
    finish();
    return h;
  };
  // 난수: 성격, 인내, (12초 문항 선택), [24초 문항 선택], 다시해줘, 떠남, 떠남 별점, 맛보기 3개, 코멘트
  const lead = [SAL, 0, 0.5, 0.5];

  it.each([
    [0.0, 0],
    [0.4, 0.5],
    [0.99, 1],
  ] as const)('떠남 별점 난수 %f → %f★ (0.5 단위)', (v, stars) => {
    const h = walk([...lead, 0.99, 0.1, v, 0, 0, 0, 0.0]);
    expect(h.of('plate/scored')[0]).toMatchObject({ stars: 1 });
    expect(h.of('customer/walked-out')).toEqual([{ customerId: expect.any(String), stars }]);
    expect(h.of('customer/redo-requested')).toEqual([]);
    const review = h.of('review/issued')[0]?.review;
    expect(review).toMatchObject({ source: 'customer', stars, personality: 'salaryman' });
    expect(review?.comment).toBe(syntheticDataV2.reviewComments('salaryman', 1)[0]); // 0~1점은 1 구간
    expect(h.of('customer/left')).toHaveLength(1);
    expect(h.game.state.reviews.at(-1)?.stars).toBe(stars);
  });

  it('떠남 순서: plate/tasted → plate/scored → customer/walked-out → review/issued → customer/left', () => {
    const h = walk([...lead, 0.99, 0.1, 0.99]);
    const types = ['plate/tasted', 'plate/scored', 'customer/walked-out', 'review/issued', 'customer/left'];
    expect(h.log.map((r) => r.type).filter((t) => types.includes(t))).toEqual(types);
  });

  it('난수가 15% 이상이면 떠나지 않고 접시 별점 그대로 리뷰한다(경계 0.15)', () => {
    const h = walk([...lead, 0.99, 0.15, 0.99]);
    expect(h.of('customer/walked-out')).toEqual([]);
    expect(h.of('review/issued')[0]?.review.stars).toBe(1);
  });

  it('별점 1.5도 대상이다', () => {
    // 12초 나쁜 답 → 70, 접시 -40 → 30 → 1.5★(문항 선택 난수는 하나)
    const h = walk([SAL, 0, 0.5, 0.99, 0.1, 0.99], undefined, true);
    expect(h.of('plate/scored')[0]).toMatchObject({ stars: 1.5 });
    expect(h.of('customer/walked-out')).toHaveLength(1);
  });

  it('별점 2.0이면 떠남 난수를 뽑지 않는다', () => {
    // 접시 -40 → 40 → 2.0★. 다시해줘 난수(불발) 1 + 맛보기 2(속 없음·함정) + 코멘트 1 + 셔플 5
    const s = scripted([SAL, 0.5, 0.99]);
    const h = setupV2({ rng: s.rng });
    toP2(h);
    const before = s.used();
    makePlate(h, [{ filling: 'none' }, { filling: 'wasabi' }]);
    expect(s.used() - before).toBe(1 + 2 + 1 + 5);
    expect(h.of('customer/walked-out')).toEqual([]);
  });

  it('떠남 리뷰도 집계된다(리뷰 발급 접시 수에 포함)', () => {
    const h = walk([...lead, 0.99, 0.1, 0.99]);
    h.tick(2);
    makePlate(h);
    expect(h.game.state.level).toBe(3);
  });
});
