import { describe, expect, it } from 'vitest';
import type { RollZone } from '../../contracts';
import { makePlate, playUntilLevel, reach, setupV2 } from './helpers-v2';

const MISS_ALL = { miss1: true, miss2: true }; // 적중 0: P1 접시 80점

/** 구멍 15를 익힘 완료로 두고 그 구멍의 영역(W1)을 본다. 구멍 15는 접시(0~5)에 쓰이지 않는다. */
const zoneAt = (h: ReturnType<typeof setupV2>): RollZone => h.hole(15).rollZone as RollZone;

describe('타이밍 영역 교체: 단계 시작과 가게 점수 200점마다(GDD §굽기)', () => {
  it('가게 점수가 200의 배수 경계를 넘으면 영역을 한 번 다시 뽑는다(score/plate 직후)', () => {
    // 뽑기 순서: 1단계 시작, 2단계 시작, 200 경계. 마지막 값 0.1 → 폭 0.30 영역이 0.07에서 시작한다.
    const h = setupV2({ zoneValues: [0.5, 0.5, 0.1] });
    reach(h, 15, 3);
    makePlate(h, MISS_ALL); // P1: 80점, 2단계 시작
    expect(h.game.state.shopScore).toBe(80);
    expect(h.zoneDraws()).toBe(2);
    expect(zoneAt(h).from).toBeCloseTo(0.35, 9);
    let drawsAtScore = -1;
    h.bus.on('score/plate', () => (drawsAtScore = h.zoneDraws()));
    makePlate(h); // 2단계 첫 접시: 완벽 160점 → 240, 200 경계를 넘는다
    expect(h.game.state.shopScore).toBe(240);
    expect(drawsAtScore).toBe(2); // score/plate 시점에는 아직 안 뽑았다
    expect(h.zoneDraws()).toBe(3); // 그 직후 1회
    expect(zoneAt(h).from).toBeCloseTo(0.07, 9);
  });

  it('경계를 넘지 않으면 영역이 그대로다', () => {
    const h = setupV2({ zoneValues: [0.5, 0.5, 0.1] });
    reach(h, 15, 3);
    makePlate(h, MISS_ALL); // 80
    const z = zoneAt(h);
    makePlate(h, MISS_ALL); // 2단계 첫 접시: 80 → 160 < 200
    expect(h.game.state.shopScore).toBe(160);
    expect(h.zoneDraws()).toBe(2);
    expect(zoneAt(h)).toEqual(z);
  });

  it('한 접시로 경계를 여러 개 넘어도 한 번만 다시 뽑는다', () => {
    // 완벽 접시 연속: 140 → 332 → 556 → 812. 556 → 812는 600·800 두 경계를 넘는다.
    const h = setupV2();
    const scores: number[] = [];
    const draws: number[] = [];
    h.bus.on('score/plate', () => scores.push(h.game.state.shopScore));
    const plate = () => {
      makePlate(h);
      draws.push(h.zoneDraws());
    };
    plate(); // 1단계 접시 → 2단계 시작
    plate(); // 332: 경계 1
    plate(); // 556: 경계 2, 3단계 시작
    plate(); // 812: 경계 3·4를 한꺼번에
    expect(scores).toEqual([140, 332, 556, 812]);
    // 1단계 시작 1 + [2단계 시작] + [경계] + [경계 + 3단계 시작] + [경계 1회]
    expect(draws).toEqual([2, 3, 5, 6]);
  });

  it('단계가 시작될 때마다 다시 뽑는다(점수가 경계를 넘지 않는 접시로 확인)', () => {
    const h = setupV2({ zoneValues: [0.5, 0.2] });
    reach(h, 15, 3);
    expect(h.zoneDraws()).toBe(1);
    makePlate(h, MISS_ALL); // 80점, 경계 없음 → 2단계 시작
    expect(h.zoneDraws()).toBe(2);
    expect(zoneAt(h).from).toBeCloseTo(0.2 * 0.7, 9);
  });

  it('6단계부터 단계 시작에 W1 → W2 순으로 함께 뽑는다', () => {
    // 같은 진행을 두 번 돌린다. 먼저 6단계 시작 직전까지의 뽑기 횟수를 센 뒤, 마지막 두 번(W1·W2)만 지정한다.
    const holes = (h: ReturnType<typeof setupV2>) => {
      reach(h, 15, 3); // W1 구경꾼: 익힘 완료
      reach(h, 14, 5); // 굴림 1 구멍: W2를 보여 준다
    };
    const dry = setupV2();
    holes(dry);
    let n = -1;
    dry.bus.on('phase/changed', (e) => {
      if (e.level === 6) n = dry.zoneDraws();
    });
    playUntilLevel(dry, 6);
    expect(n).toBeGreaterThan(2);

    const values = [...Array.from({ length: n - 2 }, () => 0.5), 0.1, 0.9];
    const h = setupV2({ zoneValues: values });
    holes(h);
    let w1: RollZone | null = null;
    let w2: RollZone | null = null;
    h.bus.on('phase/changed', (e) => {
      if (e.level !== 6) return;
      w1 = h.hole(15).rollZone;
      w2 = h.hole(14).rollZone;
    });
    playUntilLevel(h, 6);
    expect(h.zoneDraws()).toBe(n);
    expect((w1 as RollZone | null)?.from).toBeCloseTo(0.1 * 0.76, 9); // W1 폭 0.24
    expect((w1 as RollZone | null)?.to).toBeCloseTo(0.1 * 0.76 + 0.24, 9);
    expect((w2 as RollZone | null)?.from).toBeCloseTo(0.72, 9); // 난수 0.9, W2 폭 0.20(중심 0.82)
    expect((w2 as RollZone | null)?.to).toBeCloseTo(0.92, 9);
  });

  it('튜토리얼은 점수가 0이라 영역이 바뀌지 않는다(뽑기 없음)', () => {
    const h = setupV2({ tutorial: true });
    h.tick(30);
    expect(h.zoneDraws()).toBe(0);
  });
});
