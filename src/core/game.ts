// 게임 본체: 굽기 상태머신·판정·손님·대화·점수·페이즈·세션 저장. 규칙 원본은 docs/GDD.md.
import type {
  ActiveDialogue,
  CookStep,
  Customer,
  Doneness,
  DialogueLine,
  EventBus,
  GameEvents,
  GameState,
  HoleState,
  Ingredient,
  IngredientId,
  Personality,
  PhaseId,
  ReviewResult,
  SessionStore,
} from '../contracts';
import {
  EPS,
  STEP_ORDER,
  TRAY_SOURCE,
  createDonenessJudge,
  gaugeValue,
  isGaugeStep,
  isRollStep,
} from './cooking';
import {
  ANSWER_LIMIT_SEC,
  PHASES,
  REPLACEMENT_DELAY_SEC,
  SECOND_CUSTOMER_DELAY_SEC,
  TARGET_PLATES,
  nextPhase,
} from './phases';
import { randomIndex, shuffle } from './rng';
import {
  BAD_ANSWER,
  GOOD_ANSWER,
  START_SATISFACTION,
  TIMEOUT,
  applySatisfaction,
  plateDeltas,
  sessionAverage,
  starsFromSatisfaction,
} from './scoring';

/** main이 src/data를 읽어 주입한다(core는 data를 import하지 않는다). */
export interface GameData {
  /** 성격마다 1개 이상 있어야 한다. */
  readonly dialogues: readonly DialogueLine[];
  /** 별점 구간(1~5, 0.5★는 내림)·성격별 후보. 하나를 무작위로 고른다. */
  reviewComments(personality: Personality, bucket: 1 | 2 | 3 | 4 | 5): readonly string[];
  readonly tutorialComment: string;
}

export interface GameOptions {
  readonly bus: EventBus;
  readonly data: GameData;
  /** [0, 1) 난수. 시드를 고정해 재현한다. */
  readonly rng: () => number;
  readonly store: SessionStore;
}

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
const HOLE_COUNT = 6;

interface Hole {
  step: CookStep;
  /** 현재 단계 진입 후 경과 시간(초). */
  elapsed: number;
  filling: IngredientId | null;
  judgements: Doneness[];
  /** 익음 게이지에서 덜익음/탐이 나왔다. */
  badDoneness: boolean;
  rollFailed: boolean;
}

interface Guest {
  readonly id: string;
  readonly personality: Personality;
  readonly slot: number;
  readonly intervalSec: number;
  satisfaction: number;
  untilDialogue: number;
  dialogue: { readonly line: DialogueLine; remaining: number } | null;
}

const newHole = (): Hole => ({
  step: 'margarine',
  elapsed: 0,
  filling: null,
  judgements: [],
  badDoneness: false,
  rollFailed: false,
});

export class Game {
  private readonly bus: EventBus;
  private readonly data: GameData;
  private readonly rng: () => number;
  private readonly store: SessionStore;

  private phase: PhaseId = 'tutorial';
  private holes: Hole[] = [];
  private tray: Ingredient[] = [];
  private guests: Guest[] = [];
  /** 슬롯별 다음 입장까지 남은 초. null이면 입장 예약 없음. */
  private spawnTimers: (number | null)[] = [];
  /** 이 페이즈에서 완성(서빙)한 접시 수. */
  private plates = 0;
  /** 6구를 완성했지만 서빙할 손님이 아직 없다. */
  private plateReady = false;
  private reviews: ReviewResult[] = [];
  private tutorialCompleted = false;
  private isFinished = false;
  private guestSeq = 0;
  private readonly usedLines = new Map<Personality, Set<DialogueLine>>();

  constructor(opts: GameOptions) {
    this.bus = opts.bus;
    this.data = opts.data;
    this.rng = opts.rng;
    this.store = opts.store;
    for (const p of PERSONALITIES) {
      if (!opts.data.dialogues.some((l) => l.personality === p)) throw new Error(`대사 데이터에 ${p} 문항이 없다`);
      for (const bucket of [1, 2, 3, 4, 5] as const) {
        if (opts.data.reviewComments(p, bucket).length === 0) throw new Error(`리뷰 코멘트가 없다: ${p} ${bucket}★ 구간`);
      }
    }
    this.bus.on('input/cook', (e) => this.onCook(e));
    this.bus.on('input/answer', (e) => this.onAnswer(e));

    const saved = this.store.load();
    if (saved?.finished) {
      this.isFinished = true;
      this.tutorialCompleted = true;
      this.reviews = [...saved.reviews];
      this.phase = 'P5';
      this.resetPlate();
      return;
    }
    if (saved?.tutorialCompleted) {
      // 본게임 도중 새로고침: 튜토리얼 리뷰만 남기고 P1부터 다시 시작한다.
      this.tutorialCompleted = true;
      this.reviews = saved.reviews.filter((r) => r.source === 'tutorial');
      this.startPhase('P1');
      return;
    }
    this.startPhase('tutorial');
  }

  get finished(): boolean {
    return this.isFinished;
  }

  get state(): GameState {
    const holes: HoleState[] = this.holes.map((h, index) => ({
      index,
      step: h.step,
      gauge: gaugeValue(h.step, h.elapsed),
      filling: h.filling,
      judgements: [...h.judgements],
    }));
    const activeDialogues: ActiveDialogue[] = [];
    for (const g of this.guests) {
      if (g.dialogue) activeDialogues.push({ customerId: g.id, line: g.dialogue.line, remainingSec: g.dialogue.remaining });
    }
    return {
      phase: this.phase,
      holes,
      tray: [...this.tray],
      customers: this.guests.map(toCustomer),
      activeDialogues,
      reviews: [...this.reviews],
      sessionAverage: sessionAverage(this.reviews),
      tutorialCompleted: this.tutorialCompleted,
    };
  }

  /**
   * 시간을 dt초 진행한다. 이벤트는 틱 끝에서 한꺼번에 처리하므로 dt는 프레임 크기(≤ 0.1)로 쓴다.
   * shortcut: 큰 dt 하나로 여러 사건을 건너뛰면 사건 순서가 뭉개진다, 오프라인 진행이 필요하면 dt를 쪼개 호출.
   */
  tick(dt: number): void {
    if (this.isFinished) return;
    for (const h of this.holes) {
      if (isGaugeStep(h.step) || isRollStep(h.step)) h.elapsed += dt;
    }
    for (const g of [...this.guests]) this.tickDialogue(g, dt);
    this.tickSpawns(dt);
  }

  // ── 굽기 ──────────────────────────────────────────────

  private onCook(e: GameEvents['input/cook']): void {
    if (this.isFinished) return;
    const hole = this.holes[e.hole];
    if (hole === undefined) return;

    if (this.phase === 'tutorial') {
      const expected = this.expectedStep();
      if (expected !== undefined && (e.step !== expected || hole.step !== e.step)) {
        this.bus.emit('tutorial/invalid-tap', { expected });
        return;
      }
    } else if (hole.step !== e.step) {
      return;
    }
    if (hole.step === 'done') return;

    if (hole.step === 'filling') {
      if (e.ingredient === undefined) return;
      if (this.phase === 'tutorial' && e.ingredient !== 'octopus') {
        this.bus.emit('tutorial/trap-warning', { ingredient: e.ingredient });
        return;
      }
      hole.filling = e.ingredient;
      this.bus.emit('cook/ingredient-added', { hole: e.hole, ingredient: e.ingredient });
    } else if (isGaugeStep(hole.step) || isRollStep(hole.step)) {
      const d = createDonenessJudge(this.phase === 'tutorial').judge(hole.step, gaugeValue(hole.step, hole.elapsed));
      hole.judgements.push(d);
      if (isGaugeStep(hole.step) && d !== 'perfect') hole.badDoneness = true;
      if (isRollStep(hole.step) && d !== 'perfect') hole.rollFailed = true;
      this.bus.emit('cook/judged', { hole: e.hole, step: hole.step, doneness: d });
    }
    this.advance(e.hole, hole);
  }

  /** 튜토리얼에서 유효한 탭 단계: 6구 중 가장 뒤처진 구멍의 단계. 전부 done이면 undefined. */
  private expectedStep(): CookStep | undefined {
    let min = STEP_ORDER.length - 1;
    for (const h of this.holes) min = Math.min(min, STEP_ORDER.indexOf(h.step));
    return min === STEP_ORDER.length - 1 ? undefined : STEP_ORDER[min];
  }

  private advance(index: number, hole: Hole): void {
    const next = STEP_ORDER[STEP_ORDER.indexOf(hole.step) + 1];
    if (next === undefined) return;
    hole.step = next;
    hole.elapsed = 0;
    this.bus.emit('cook/step-advanced', { hole: index, step: next });
    if (next !== 'done') return;
    this.bus.emit('cook/completed', { hole: index });
    if (this.holes.every((h) => h.step === 'done')) this.onPlateComplete();
  }

  private resetPlate(): void {
    this.holes = Array.from({ length: HOLE_COUNT }, newHole);
    this.tray = shuffle(TRAY_SOURCE, this.rng);
  }

  // ── 접시·서빙 ─────────────────────────────────────────

  private onPlateComplete(): void {
    if (this.phase === 'tutorial') return this.finishTutorial();
    if (PHASES[this.phase].customerCount === 0) return this.completeWithoutServing();
    this.plateReady = true;
    this.tryServe();
  }

  private finishTutorial(): void {
    const review: ReviewResult = { source: 'tutorial', stars: 5, comment: this.data.tutorialComment, personality: null };
    this.reviews.push(review);
    this.tutorialCompleted = true;
    this.store.save({ version: 1, tutorialCompleted: true, finished: false, reviews: [...this.reviews] });
    this.bus.emit('review/issued', { review });
    this.startPhase('P1');
  }

  private completeWithoutServing(): void {
    this.plates++;
    this.resetPlate();
    this.afterPlate();
  }

  private tryServe(): void {
    const guest = this.guests[0];
    if (!this.plateReady || guest === undefined) return;
    const facts = {
      perfect: this.holes.every((h) => !h.badDoneness && !h.rollFailed && h.filling === 'octopus'),
      hasBadDoneness: this.holes.some((h) => h.badDoneness),
      hasTrap: this.holes.some((h) => h.filling !== null && h.filling !== 'octopus'),
    };
    for (const d of plateDeltas(facts)) guest.satisfaction = applySatisfaction(guest.satisfaction, d);

    const stars = starsFromSatisfaction(guest.satisfaction);
    const bucket = Math.min(5, Math.max(1, Math.floor(stars))) as 1 | 2 | 3 | 4 | 5;
    const comments = this.data.reviewComments(guest.personality, bucket);
    const review: ReviewResult = {
      source: 'customer',
      stars,
      comment: comments[randomIndex(comments.length, this.rng)] ?? '',
      personality: guest.personality,
    };
    if (PHASES[this.phase].countsReviews) this.reviews.push(review);
    this.bus.emit('review/issued', { review });

    this.guests.shift();
    this.spawnTimers[guest.slot] = REPLACEMENT_DELAY_SEC;
    this.bus.emit('customer/left', { customerId: guest.id });

    this.plateReady = false;
    this.plates++;
    this.resetPlate();
    this.afterPlate();
  }

  private afterPlate(): void {
    if (this.plates < TARGET_PLATES[this.phase]) return;
    const next = nextPhase(this.phase);
    if (next === null) this.finish();
    else this.startPhase(next);
  }

  private finish(): void {
    this.isFinished = true;
    this.guests = [];
    this.spawnTimers = [];
    this.store.save({ version: 1, tutorialCompleted: true, finished: true, reviews: [...this.reviews] });
  }

  private startPhase(id: PhaseId): void {
    this.phase = id;
    this.plates = 0;
    this.plateReady = false;
    this.guests = [];
    this.spawnTimers = PHASES[id].dialogueIntervalsSec.map((_, slot) => (slot === 0 ? 0 : SECOND_CUSTOMER_DELAY_SEC));
    this.resetPlate();
    this.bus.emit('phase/changed', { phase: id });
    this.tickSpawns(0);
  }

  // ── 손님·대화 ─────────────────────────────────────────

  private tickSpawns(dt: number): void {
    const due: number[] = [];
    this.spawnTimers.forEach((t, slot) => {
      if (t === null) return;
      const left = t - dt;
      if (left <= EPS) {
        this.spawnTimers[slot] = null;
        due.push(slot);
      } else this.spawnTimers[slot] = left;
    });
    const phase = this.phase;
    for (const slot of due) {
      // 서빙이 페이즈를 넘겼으면(입장 중 대기 접시 서빙) 남은 입장은 버린다.
      if (this.phase !== phase) return;
      if (this.plates + this.guests.length < TARGET_PLATES[phase]) this.spawn(slot);
    }
  }

  private spawn(slot: number): void {
    const intervalSec = PHASES[this.phase].dialogueIntervalsSec[slot] ?? 0;
    const guest: Guest = {
      id: `c${++this.guestSeq}`,
      personality: PERSONALITIES[randomIndex(PERSONALITIES.length, this.rng)] as Personality,
      slot,
      intervalSec,
      satisfaction: START_SATISFACTION,
      untilDialogue: intervalSec,
      dialogue: null,
    };
    this.guests.push(guest);
    this.bus.emit('customer/arrived', { customer: toCustomer(guest) });
    this.tryServe();
  }

  private tickDialogue(g: Guest, dt: number): void {
    if (g.dialogue) {
      g.dialogue.remaining -= dt;
      if (g.dialogue.remaining <= EPS) this.resolve(g, 'timeout');
      return;
    }
    g.untilDialogue -= dt;
    if (g.untilDialogue > EPS) return;
    const line = this.pickLine(g.personality);
    g.dialogue = { line, remaining: ANSWER_LIMIT_SEC };
    this.bus.emit('dialogue/started', { customerId: g.id, line });
  }

  /** 성격 내 문항은 세션 동안 반복하지 않는다. shortcut: 10문항을 다 쓰면 그 성격 풀을 초기화한다, GDD가 정하면 교체. */
  private pickLine(personality: Personality): DialogueLine {
    const pool = this.data.dialogues.filter((l) => l.personality === personality);
    const used = this.usedLines.get(personality) ?? new Set<DialogueLine>();
    let fresh = pool.filter((l) => !used.has(l));
    if (fresh.length === 0) {
      used.clear();
      fresh = pool;
    }
    const line = fresh[randomIndex(fresh.length, this.rng)] as DialogueLine;
    used.add(line);
    this.usedLines.set(personality, used);
    return line;
  }

  private onAnswer(e: GameEvents['input/answer']): void {
    if (this.isFinished) return;
    const g = this.guests.find((x) => x.id === e.customerId);
    if (g?.dialogue) this.resolve(g, e.choice);
  }

  private resolve(g: Guest, outcome: 'good' | 'bad' | 'timeout'): void {
    const delta = outcome === 'good' ? GOOD_ANSWER : outcome === 'bad' ? BAD_ANSWER : TIMEOUT;
    g.satisfaction = applySatisfaction(g.satisfaction, delta);
    g.dialogue = null;
    g.untilDialogue = g.intervalSec;
    this.bus.emit('dialogue/resolved', { customerId: g.id, outcome });
  }
}

const toCustomer = (g: Guest): Customer => ({
  id: g.id,
  personality: g.personality,
  satisfaction: g.satisfaction,
  dialogueIntervalSec: g.intervalSec,
});
