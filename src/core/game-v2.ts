// 게임 본체(굽기 개편): 구멍별 독립 상태기계·후네 서빙·인내·다시해줘·떠남·튜토리얼. 규칙 원본은 docs/GDD.md.
// 옛 game.ts는 ui·main이 아직 쓰므로 그대로 두고, ui·render 전환 뒤 integrator 병합 때 이 파일로 대체한다.
import type {
  ActiveDialogue,
  CustomerStatus,
  DialogueLine,
  DropTarget,
  EventBus,
  FuneItem,
  GameEvents,
  GameStateV2,
  HoleStage,
  HoleStateV2,
  Ingredient,
  IngredientId,
  PatienceLevel,
  Personality,
  PhaseId,
  PlateDefect,
  RejectReason,
  ReviewResult,
  RollZone,
  SessionStore,
  TasteKind,
  TasteLines,
  TutorialStage,
} from '../contracts';
import { EPS, TRAY_SOURCE, rollPosition } from './cooking';
import {
  BURN_AT_SEC,
  COOK_SEC,
  DARK_AT_SEC,
  FULL_ZONE,
  FUNE_SIZE,
  HOLE_COUNT,
  W1,
  W2,
  accepts,
  inZone,
} from './cooking-v2';
import { ANSWER_LIMIT_SEC, PHASES, REPLACEMENT_DELAY_SEC, SECOND_CUSTOMER_DELAY_SEC, TARGET_PLATES, nextPhase } from './phases';
import { randomIndex, shuffle } from './rng';
import { BAD_ANSWER, GOOD_ANSWER, START_SATISFACTION, TIMEOUT, applySatisfaction, sessionAverage, starsFromSatisfaction } from './scoring';
import {
  PATIENCE_EXPIRED,
  REDO_CHANCE,
  REDO_MAX_STARS,
  WALKOUT_CHANCE,
  WALKOUT_MAX_STARS,
  commentBucket,
  darkCapRange,
  plateChanges,
  plateDefects,
} from './scoring-v2';

/** main이 src/data를 읽어 주입한다(core는 data를 import하지 않는다). 맛보기 대사는 TasteLines 포트로 받는다. */
export interface GameDataV2 {
  /** 성격마다 1개 이상 있어야 한다. */
  readonly dialogues: readonly DialogueLine[];
  /** 별점 구간(1~5, 0.5★는 내림)·성격별 후보. 하나를 무작위로 고른다. */
  reviewComments(personality: Personality, bucket: 1 | 2 | 3 | 4 | 5): readonly string[];
  readonly tutorialComment: string;
  readonly tasteLines: TasteLines;
}

export interface GameOptionsV2 {
  readonly bus: EventBus;
  readonly data: GameDataV2;
  /** [0, 1) 난수. 시드를 고정해 재현한다. */
  readonly rng: () => number;
  readonly store: SessionStore;
}

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
const TASTE_KINDS: readonly TasteKind[] = ['no-filling', 'trap', 'dark', 'roll-miss', 'perfect'];
/** 손님 인내: 20~40초 사이 무작위. */
const PATIENCE_MIN_SEC = 20;
const PATIENCE_MAX_SEC = 40;
/** 얼굴 단계 경계(경과 비율). */
const ANNOYED_AT = 0.5;
const ANGRY_AT = 0.8;
const FACES: readonly PatienceLevel[] = ['normal', 'annoyed', 'angry'];

interface Hole {
  stage: HoleStage;
  cookElapsed: number;
  burnElapsed: number;
  filling: IngredientId | null;
  noFilling: boolean;
  rollHits: [boolean | null, boolean | null];
}

const newHole = (): Hole => ({ stage: 'empty', cookElapsed: 0, burnElapsed: 0, filling: null, noFilling: false, rollHits: [null, null] });

interface Guest {
  readonly id: string;
  readonly personality: Personality;
  readonly slot: number;
  readonly intervalSec: number;
  /** 대화·인내 증감만 반영한 만족도. 접시 증감은 서빙 때 사본에 적용하고, 다시해줘면 버린다. */
  satisfaction: number;
  untilDialogue: number;
  dialogue: { readonly line: DialogueLine; remaining: number } | null;
  readonly patienceTotal: number;
  patienceElapsed: number;
  face: PatienceLevel;
  patienceExpired: boolean;
  redoUsed: boolean;
  awaitingRedo: boolean;
}

/** 튜토리얼 유도 순서. 각 단계는 6구가 minRank 이상이 되면 끝난다(순위: 빈칸 0 … 완성 6). */
const TUTORIAL_FLOW: readonly { readonly stage: TutorialStage; readonly minRank: number }[] = [
  { stage: 'margarine', minRank: 1 },
  { stage: 'batter', minRank: 2 },
  { stage: 'cook-wait', minRank: 3 },
  { stage: 'filling', minRank: 4 },
  { stage: 'roll-1', minRank: 5 },
  { stage: 'roll-2', minRank: 6 },
];
const RANK: Readonly<Record<HoleStage, number>> = { empty: 0, greased: 1, cooking: 2, cooked: 3, filled: 4, rolled: 5, done: 6, dark: 7, burnt: 8 };

export class GameV2 {
  private readonly bus: EventBus;
  private readonly data: GameDataV2;
  private readonly rng: () => number;
  private readonly store: SessionStore;

  private phase: PhaseId = 'tutorial';
  private holes: Hole[] = Array.from({ length: HOLE_COUNT }, newHole);
  private tray: Ingredient[] = [...TRAY_SOURCE];
  private fune: FuneItem[] = [];
  private holding: number | null = null;
  private barTime = 0;
  /** 바에 영역을 보일 구멍: 마지막으로 재료를 놓거나 굴린 구멍. */
  private lastTouched: number | null = null;
  private tutorialIndex = 0;
  private guests: Guest[] = [];
  /** 슬롯별 다음 입장까지 남은 초. null이면 입장 예약 없음. */
  private spawnTimers: (number | null)[] = [];
  /** 이 페이즈에서 리뷰를 발급한 접시 수. */
  private plates = 0;
  private reviews: ReviewResult[] = [];
  private tutorialCompleted = false;
  private isFinished = false;
  private guestSeq = 0;
  private readonly usedLines = new Map<Personality, Set<DialogueLine>>();

  constructor(opts: GameOptionsV2) {
    this.bus = opts.bus;
    this.data = opts.data;
    this.rng = opts.rng;
    this.store = opts.store;
    for (const p of PERSONALITIES) {
      if (!opts.data.dialogues.some((l) => l.personality === p)) throw new Error(`대사 데이터에 ${p} 문항이 없다`);
      for (const bucket of [1, 2, 3, 4, 5] as const) {
        if (opts.data.reviewComments(p, bucket).length === 0) throw new Error(`리뷰 코멘트가 없다: ${p} ${bucket}★ 구간`);
      }
      for (const kind of TASTE_KINDS) {
        if ((opts.data.tasteLines[p]?.[kind] ?? []).length === 0) throw new Error(`맛보기 대사가 없다: ${p} ${kind}`);
      }
    }
    this.bus.on('input/place-material', (e) => this.onPlace(e));
    this.bus.on('input/roll', (e) => this.onRoll(e));
    this.bus.on('input/pick', (e) => this.onPick(e));
    this.bus.on('input/drop', (e) => this.onDrop(e));
    this.bus.on('input/answer', (e) => this.onAnswer(e));

    const saved = this.store.load();
    if (saved?.finished) {
      this.isFinished = true;
      this.tutorialCompleted = true;
      this.reviews = [...saved.reviews];
      this.phase = 'P5';
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

  get state(): GameStateV2 {
    const timerRunning = (h: Hole, i: number): boolean =>
      this.phase !== 'tutorial' && (h.stage === 'done' || h.stage === 'dark') && this.holding !== i && this.fune.length < FUNE_SIZE;
    const running = this.holes.filter(timerRunning).length;
    const holes: HoleStateV2[] = this.holes.map((h, index) => ({
      index,
      stage: h.stage,
      cookElapsedSec: h.stage === 'cooking' ? h.cookElapsed : 0,
      burnElapsedSec: h.stage === 'done' || h.stage === 'dark' || h.stage === 'burnt' ? h.burnElapsed : 0,
      filling: h.filling,
      noFilling: h.noFilling,
      rollHits: [h.rollHits[0], h.rollHits[1]],
      rollZone: this.zoneOf(h),
      warn: running >= 2 && timerRunning(h, index),
    }));
    const activeDialogues: ActiveDialogue[] = [];
    for (const g of this.guests) {
      if (g.dialogue) activeDialogues.push({ customerId: g.id, line: g.dialogue.line, remainingSec: g.dialogue.remaining });
    }
    const touched = this.lastTouched === null ? undefined : this.holes[this.lastTouched];
    return {
      phase: this.phase,
      holes,
      tray: [...this.tray],
      barPosition: rollPosition(this.barTime),
      barZone: touched === undefined ? null : this.zoneOf(touched),
      fune: [...this.fune],
      holding: this.holding,
      customers: this.guests.map(toStatus),
      activeDialogues,
      reviews: [...this.reviews],
      sessionAverage: sessionAverage(this.reviews),
      tutorialCompleted: this.tutorialCompleted,
      tutorialStage: this.tutorialStage(),
    };
  }

  /**
   * 시간을 dt초 진행한다. 큰 dt는 프레임 크기(≤ 0.1)로 쪼개 호출한다.
   * shortcut: 한 틱 안의 사건은 구멍 → 손님 → 입장 순으로 처리해 순서가 뭉개진다, 오프라인 진행이 필요하면 dt를 쪼개 호출.
   */
  tick(dt: number): void {
    if (this.isFinished) return;
    this.barTime += dt;
    this.tickHoles(dt);
    for (const g of [...this.guests]) {
      this.tickDialogue(g, dt);
      this.tickPatience(g, dt);
    }
    this.tickSpawns(dt);
    this.advanceTutorial();
  }

  // ── 구멍 ──────────────────────────────────────────────

  private zoneOf(h: Hole): RollZone | null {
    // 익힘·익힘 완료 탭도 W1로 판정한다(속재료 전 굴리기). 튜토리얼은 이 탭을 거부하므로 영역이 없다.
    if (h.stage === 'cooking' || h.stage === 'cooked') return this.phase === 'tutorial' ? null : W1;
    if (h.stage === 'filled') return this.phase === 'tutorial' ? FULL_ZONE : W1;
    if (h.stage === 'rolled') return this.phase === 'tutorial' ? FULL_ZONE : W2;
    return null;
  }

  private tickHoles(dt: number): void {
    // 후네가 가득 차 서빙을 기다리는 동안은 탐 타이머가 멈춘다. 튜토리얼에는 탐 타이머가 없다.
    // 도달 불가: 구멍 6개, 익힘 3초가 교체 입장 2초보다 길다(방어 코드).
    const burnFrozen = this.fune.length >= FUNE_SIZE || this.phase === 'tutorial';
    this.holes.forEach((h, index) => {
      if (h.stage === 'cooking') {
        h.cookElapsed += dt;
        if (h.cookElapsed >= COOK_SEC - EPS) {
          h.stage = 'cooked';
          h.cookElapsed = 0;
        }
        return;
      }
      if ((h.stage !== 'done' && h.stage !== 'dark') || burnFrozen || this.holding === index) return;
      h.burnElapsed += dt;
      if (h.stage === 'done' && h.burnElapsed >= DARK_AT_SEC - EPS) {
        h.stage = 'dark';
        this.bus.emit('cook/darkened', { hole: index });
      }
      if (h.stage === 'dark' && h.burnElapsed >= BURN_AT_SEC - EPS) {
        h.stage = 'burnt';
        this.bus.emit('cook/burnt', { hole: index });
      }
    });
  }

  private reject(hole: number, reason: RejectReason): void {
    this.bus.emit('cook/rejected', { hole, reason });
  }

  /** 튜토리얼에서 현재 유도 단계가 아닌 조작: 원위치시키고 화살표를 흔든다. */
  private rejectTutorial(hole: number): void {
    this.reject(hole, 'tutorial-step');
    this.bus.emit('tutorial/invalid-action', { expected: this.tutorialStage() ?? 'fune' });
  }

  private onPlace(e: GameEvents['input/place-material']): void {
    const hole = this.holes[e.hole];
    if (this.isFinished || hole === undefined) return;
    const m = e.material;
    if (this.phase === 'tutorial') {
      const wanted = { margarine: 'margarine', batter: 'batter', filling: 'filling' } as const;
      const stage = this.tutorialStage();
      if (stage === null || wanted[stage as keyof typeof wanted] !== m.kind || !accepts(hole.stage, m)) return this.rejectTutorial(e.hole);
      if (m.kind === 'filling' && m.ingredient !== 'octopus') {
        this.bus.emit('tutorial/trap-warning', { ingredient: m.ingredient });
        return this.reject(e.hole, 'tutorial-step');
      }
    } else if (!accepts(hole.stage, m)) {
      return this.reject(e.hole, 'invalid-stage');
    }
    this.lastTouched = e.hole;
    if (m.kind === 'margarine') hole.stage = 'greased';
    else if (m.kind === 'batter') {
      hole.stage = 'cooking';
      hole.cookElapsed = 0;
    } else {
      hole.stage = 'filled';
      hole.filling = m.ingredient;
    }
    this.advanceTutorial();
  }

  private onRoll(e: GameEvents['input/roll']): void {
    const hole = this.holes[e.hole];
    if (this.isFinished || hole === undefined) return;
    if (this.phase === 'tutorial') {
      const stage = this.tutorialStage();
      if (!((stage === 'roll-1' && hole.stage === 'filled') || (stage === 'roll-2' && hole.stage === 'rolled'))) return this.rejectTutorial(e.hole);
    }
    this.lastTouched = e.hole;
    if (hole.stage === 'filled') return this.doRoll(e.hole, hole, 0, W1);
    if (hole.stage === 'cooking' || hole.stage === 'cooked') {
      // 속재료 전 굴리기: 속 없음으로 고정되고 그 탭이 굴리기 1이다(판정은 W1).
      hole.noFilling = true;
      hole.cookElapsed = 0;
      return this.doRoll(e.hole, hole, 0, W1);
    }
    if (hole.stage === 'rolled') return this.doRoll(e.hole, hole, 1, W2);
    this.bus.emit('cook/tap-ignored', { hole: e.hole });
  }

  private doRoll(index: number, hole: Hole, nth: 0 | 1, zone: RollZone): void {
    const hit = this.phase === 'tutorial' || inZone(rollPosition(this.barTime), zone);
    hole.rollHits[nth] = hit;
    hole.stage = nth === 0 ? 'rolled' : 'done';
    if (nth === 1) hole.burnElapsed = 0;
    this.bus.emit('cook/rolled', { hole: index, hit });
    this.advanceTutorial();
  }

  private onPick(e: GameEvents['input/pick']): void {
    const hole = this.holes[e.hole];
    if (this.isFinished || hole === undefined) return;
    if (this.holding !== null) return this.reject(e.hole, 'already-holding');
    if (this.phase === 'tutorial') {
      if (this.tutorialStage() !== 'fune' || hole.stage !== 'done') return this.rejectTutorial(e.hole);
    } else if (hole.stage !== 'done' && hole.stage !== 'dark' && hole.stage !== 'burnt') {
      return this.reject(e.hole, 'invalid-stage');
    }
    this.holding = e.hole;
  }

  private onDrop(e: { readonly target: DropTarget }): void {
    const index = this.holding;
    if (this.isFinished || index === null) return;
    const hole = this.holes[index] as Hole;
    this.holding = null; // 거부돼도 들기는 끝난다(완성품은 원위치)
    if (e.target === 'cancel') return; // 포인터 취소·백그라운드: 원래 구멍으로 돌아가 탐 타이머를 이어 센다
    if (this.phase === 'tutorial' && e.target !== 'fune') return this.rejectTutorial(index);
    if (e.target !== 'fune' || hole.stage === 'burnt') {
      // 후네 밖('other'·'offscreen')이거나 탄 것: 떨어져 사라진다(GDD §굽기)
      this.holes[index] = newHole();
      this.bus.emit('cook/dropped', { hole: index, item: hole.stage === 'burnt' ? 'burnt' : hole.stage === 'dark' ? 'dark' : 'done' });
      return;
    }
    // 도달 불가: 구멍 6개, 익힘 3초가 교체 입장 2초보다 길다(방어 코드).
    if (this.fune.length >= FUNE_SIZE) return this.reject(index, 'fune-full');
    const item: FuneItem = {
      rolledPerfectly: hole.rollHits[0] === true && hole.rollHits[1] === true,
      filling: hole.filling,
      noFilling: hole.noFilling,
      dark: hole.stage === 'dark',
    };
    this.fune.push(item);
    this.holes[index] = newHole();
    this.bus.emit('fune/added', { hole: index, item, count: this.fune.length });
    if (this.fune.length >= FUNE_SIZE) this.onFuneFull();
  }

  // ── 튜토리얼 ──────────────────────────────────────────

  private tutorialStage(): TutorialStage | null {
    if (this.phase !== 'tutorial') return null;
    return TUTORIAL_FLOW[this.tutorialIndex]?.stage ?? 'fune';
  }

  /** 6구가 모두 현재 단계의 목표 상태에 닿았으면 다음 단계로 간다(되돌아가지 않는다). */
  private advanceTutorial(): void {
    if (this.phase !== 'tutorial') return;
    for (let step = TUTORIAL_FLOW[this.tutorialIndex]; step !== undefined; step = TUTORIAL_FLOW[this.tutorialIndex]) {
      if (!this.holes.every((h) => RANK[h.stage] >= step.minRank)) return;
      this.tutorialIndex++;
    }
  }

  private finishTutorial(): void {
    const review: ReviewResult = { source: 'tutorial', stars: 5, comment: this.data.tutorialComment, personality: null };
    this.reviews.push(review);
    this.tutorialCompleted = true;
    this.fune = [];
    this.store.save({ version: 1, tutorialCompleted: true, finished: false, reviews: [...this.reviews] });
    this.bus.emit('review/issued', { review });
    this.startPhase('P1');
  }

  // ── 후네·서빙 ─────────────────────────────────────────

  private onFuneFull(): void {
    if (this.phase === 'tutorial') return this.finishTutorial();
    if (PHASES[this.phase].customerCount === 0) {
      // 손님이 없는 페이즈(P1): 서빙 없이 후네를 비우고 전환한다.
      this.fune = [];
      this.plates++;
      return this.afterPlate();
    }
    this.tryServe();
  }

  /** 가득 찬 후네를 손님에게 서빙한다. 다시해줘를 요청한 손님이 우선이고, 그 밖에는 먼저 온 손님이다. */
  private tryServe(): void {
    if (this.fune.length < FUNE_SIZE) return;
    const guest = this.guests.find((g) => g.awaitingRedo) ?? this.guests[0];
    if (guest !== undefined) this.serve(guest);
  }

  /** 난수 순서(GDD §손님 대화): 어두워짐 상한 → 다시해줘 → 떠남 → 맛보기 → 리뷰 코멘트 → (트레이 셔플). 조건이 안 맞으면 뽑지 않는다. */
  private serve(g: Guest): void {
    const items = this.fune;
    const defects = plateDefects(items);
    let sat = g.satisfaction;
    for (const d of plateChanges(items)) sat = applySatisfaction(sat, d);
    let stars = starsFromSatisfaction(sat);

    const cap = darkCapRange(items.filter((i) => i.dark).length);
    if (cap !== null) stars = Math.min(stars, cap.min + 0.5 * randomIndex((cap.max - cap.min) / 0.5 + 1, this.rng));

    const redo = !g.redoUsed && stars <= REDO_MAX_STARS && this.rng() < REDO_CHANCE;
    let walkedOutStars: number | null = null;
    if (!redo && stars <= WALKOUT_MAX_STARS && this.rng() < WALKOUT_CHANCE) walkedOutStars = 0.5 * randomIndex(3, this.rng);

    const kinds: readonly TasteKind[] = defects.length > 0 ? defects : ['perfect'];
    const lines = kinds.map((defect) => {
      const pool = this.data.tasteLines[g.personality][defect];
      return { defect, text: pool[randomIndex(pool.length, this.rng)] ?? '' };
    });

    this.bus.emit('plate/tasted', { customerId: g.id, defects: defects as readonly PlateDefect[], lines });
    this.bus.emit('plate/scored', { customerId: g.id, delta: sat - START_SATISFACTION, stars });

    if (redo) {
      g.redoUsed = true;
      g.awaitingRedo = true;
      this.bus.emit('customer/redo-requested', { customerId: g.id });
      return this.clearFune();
    }

    const finalStars = walkedOutStars ?? stars;
    const comments = this.data.reviewComments(g.personality, commentBucket(finalStars));
    const review: ReviewResult = {
      source: 'customer',
      stars: finalStars,
      comment: comments[randomIndex(comments.length, this.rng)] ?? '',
      personality: g.personality,
    };
    if (walkedOutStars !== null) this.bus.emit('customer/walked-out', { customerId: g.id, stars: walkedOutStars });
    if (PHASES[this.phase].countsReviews) this.reviews.push(review);
    this.bus.emit('review/issued', { review });
    this.guests = this.guests.filter((x) => x !== g);
    this.spawnTimers[g.slot] = REPLACEMENT_DELAY_SEC;
    this.bus.emit('customer/left', { customerId: g.id });
    this.plates++;
    this.clearFune();
    this.afterPlate();
  }

  /** 서빙하면 후네만 비운다(철판은 그대로). 서빙 시점에 트레이 위치를 셔플한다. */
  private clearFune(): void {
    this.fune = [];
    this.tray = shuffle(TRAY_SOURCE, this.rng);
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
    this.guests = [];
    this.spawnTimers = PHASES[id].dialogueIntervalsSec.map((_, slot) => (slot === 0 ? 0 : SECOND_CUSTOMER_DELAY_SEC));
    this.bus.emit('phase/changed', { phase: id });
    this.tickSpawns(0);
  }

  // ── 손님·대화·인내 ────────────────────────────────────

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
      // 서빙이 페이즈를 넘겼으면(입장 중 대기 후네 서빙) 남은 입장은 버린다.
      if (this.phase !== phase) return;
      if (this.plates + this.guests.length < TARGET_PLATES[phase]) this.spawn(slot);
    }
  }

  private spawn(slot: number): void {
    const intervalSec = PHASES[this.phase].dialogueIntervalsSec[slot] ?? 0;
    const personality = PERSONALITIES[randomIndex(PERSONALITIES.length, this.rng)] as Personality;
    const patienceTotal = PATIENCE_MIN_SEC + this.rng() * (PATIENCE_MAX_SEC - PATIENCE_MIN_SEC);
    const guest: Guest = {
      id: `c${++this.guestSeq}`,
      personality,
      slot,
      intervalSec,
      satisfaction: START_SATISFACTION,
      untilDialogue: intervalSec,
      dialogue: null,
      patienceTotal,
      patienceElapsed: 0,
      face: 'normal',
      patienceExpired: false,
      redoUsed: false,
      awaitingRedo: false,
    };
    this.guests.push(guest);
    this.bus.emit('customer/entered', { customer: toStatus(guest) });
    this.tryServe();
  }

  private tickPatience(g: Guest, dt: number): void {
    g.patienceElapsed += dt;
    const ratio = Math.min(1, (g.patienceElapsed + EPS) / g.patienceTotal);
    const target = ratio >= ANGRY_AT ? 2 : ratio >= ANNOYED_AT ? 1 : 0;
    for (let level = FACES.indexOf(g.face) + 1; level <= target; level++) {
      g.face = FACES[level] as PatienceLevel;
      this.bus.emit('customer/patience-changed', { customerId: g.id, face: g.face });
    }
    if (ratio >= 1 && !g.patienceExpired) {
      g.patienceExpired = true; // 손님은 떠나지 않고 만족도 -20을 한 번만 받는다
      g.satisfaction = applySatisfaction(g.satisfaction, PATIENCE_EXPIRED);
    }
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

  /** GDD §손님 대화: 성격 내 문항은 가능한 한 반복하지 않고, 모두 쓰면 사용 기록을 초기화한다. 기록은 저장하지 않는다. */
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

/** 공개 상태에는 만족도를 담지 않는다(점수 비공개). */
const toStatus = (g: Guest): CustomerStatus => ({
  id: g.id,
  personality: g.personality,
  dialogueIntervalSec: g.intervalSec,
  patience: Math.min(1, g.patienceElapsed / g.patienceTotal),
  face: g.face,
  awaitingRedo: g.awaitingRedo,
});
