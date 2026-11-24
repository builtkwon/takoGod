// 게임 본체(굽기 개편): 구멍별 독립 상태기계·후네 서빙·인내·다시해줘·떠남·튜토리얼. 규칙 원본은 docs/GDD.md.
import type {
  ActiveDialogue,
  BestScoreStore,
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
import { EPS, TRAY_SOURCE, trianglePosition } from './cooking';
import {
  BURN_AT_SEC,
  COOK_SEC,
  DARK_AT_SEC,
  FUNE_SERVE_DELAY_SEC,
  FUNE_SIZE,
  HOLE_COUNT,
  TUTORIAL_HOLES,
  TUTORIAL_ZONE,
  accepts,
  drawZone,
  drawZoneAwayFromCenter,
  inZone,
} from './cooking-v2';
import {
  AVOID_CHANCE,
  AVOID_FROM_LEVEL,
  FUMED_LIMIT,
  GROUP_CHANCE,
  GROUP_FROM_LEVEL,
  GROUP_PATIENCE_MULTIPLIER,
  GROUP_PLATES,
  ORDER_COUNTS,
  ORDER_FROM_LEVEL,
  RUSH_DURATION_SEC,
  RUSH_FROM_LEVEL,
  RUSH_PATIENCE_MULTIPLIER,
  RUSH_SCORE_STEP,
  VIP_CHANCE,
  VIP_FROM_LEVEL,
  VIP_PATIENCE_MULTIPLIER,
  difficulty,
  orderChance,
} from './levels';
import { ANSWER_LIMIT_SEC, REPLACEMENT_DELAY_SEC, SECOND_CUSTOMER_DELAY_SEC, phaseConfig, targetPlates } from './phases';
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
  ORDER_SCORE_BONUS,
  REPORT_CHANCE,
  type PlateContext,
  allergyViolated,
  hasEraser,
  isPerfectPlate,
  orderSucceeded,
  plateDefects,
  reportedStars,
  shopPlateScore,
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
  /** 최고 가게 점수 저장소(localStorage는 main이 조립, ADR 0004). */
  readonly bestStore: BestScoreStore;
}

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
const TASTE_KINDS: readonly TasteKind[] = ['no-filling', 'trap', 'dark', 'roll-miss', 'perfect'];
/** 얼굴 단계 경계(경과 비율). */
const ANNOYED_AT = 0.5;
const ANGRY_AT = 0.8;
/** 가게 점수가 이 값의 배수 경계를 넘을 때마다 타이밍 영역을 다시 뽑는다. */
const ZONE_SCORE_STEP = 200;
const FACES: readonly PatienceLevel[] = ['normal', 'annoyed', 'angry'];

interface Hole {
  stage: HoleStage;
  cookElapsed: number;
  burnElapsed: number;
  filling: IngredientId | null;
  noFilling: boolean;
  rollHits: [boolean | null, boolean | null];
}

const newHole = (): Hole => ({
  stage: 'empty',
  cookElapsed: 0,
  burnElapsed: 0,
  filling: null,
  noFilling: false,
  rollHits: [null, null],
});

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
  /** 입장 때 정해진 주문(10단계~)·빼 주세요(13단계~)·단체(15단계~, 주문 없는 손님만)·VIP(17단계~). 서빙·퇴장까지 바뀌지 않는다. */
  readonly order: { readonly ingredient: IngredientId; readonly count: 1 | 3 | 6 } | null;
  readonly avoid: IngredientId | null;
  /** 단체: 받은 접시 수와 접시별 별점. 첫 접시 뒤 다음 완성 접시를 우선 받는다. */
  group: { platesReceived: number; readonly stars: number[] } | null;
  readonly vip: boolean;
}

/** 비문어 재료 5종(GDD §주문의 순서: 와사비·생마늘·지우개·마시멜로·고추). */
const NON_OCTOPUS: readonly IngredientId[] = TRAY_SOURCE.filter((i) => i.id !== 'octopus').map((i) => i.id);

/** 튜토리얼 유도 순서. 각 단계는 열린 6구가 minRank 이상이 되면 끝난다(순위: 빈칸 0 … 완성 6). */
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
  private readonly bestStore: BestScoreStore;
  /** 판 시작 때 읽은 최고 가게 점수(진행 중 불변). */
  private readonly best: number | null;
  private shopScore = 0;
  /** 영역을 마지막으로 교체했을 때의 가게 점수 구간(floor(점수 / 200)). */
  private zoneBand = 0;
  private combo = 0;
  /** 후네 각 알의 굴리기 적중 수(0~2). fune과 같은 순서. */
  private funeHits: number[] = [];
  /** 러시 아워 남은 시간(초). 아니면 null. 가게 점수 1000점 경계마다 12단계부터 시작하고 진행 중에는 다시 시작하지 않는다. */
  private rushRemaining: number | null = null;
  private rushBand = 0;
  /** 빼 주세요 위반으로 화난 손님 수가 한도에 닿았다: 접시 처리를 마친 직후 판을 끝낸다. */
  private pendingDefeat = false;

  /** 단계 번호: 튜토리얼 0, 본게임 1~(무한, 난이도는 20에서 고정). */
  private level = 0;
  private fumedCount = 0;
  private holes: Hole[] = Array.from({ length: HOLE_COUNT }, newHole);
  private tray: Ingredient[] = [...TRAY_SOURCE];
  private fune: FuneItem[] = [];
  /** 후네가 찬 뒤 서빙(또는 비우기)까지 남은 초. 후네가 차 있는 동안만 의미가 있다. */
  private funeWait = 0;
  private holding: number | null = null;
  /** 타이밍 바 누적 위상(한 주기 = 1). 주기가 단계마다 달라도 위치가 끊기지 않는다. */
  private barCycles = 0;
  /** 판 공용 영역(GDD §굽기). 굴리기 1용 W1과 굴리기 2용 W2. 튜토리얼은 고정. */
  private zoneW1: RollZone = TUTORIAL_ZONE;
  private zoneW2: RollZone = TUTORIAL_ZONE;
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
    this.bestStore = opts.bestStore;
    this.best = opts.bestStore.load();
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
      this.level = 1;
      return;
    }
    if (saved?.tutorialCompleted) {
      // 본게임 도중 새로고침: 튜토리얼 리뷰만 남기고 1단계부터 다시 시작한다.
      this.tutorialCompleted = true;
      this.reviews = saved.reviews.filter((r) => r.source === 'tutorial');
      this.startLevel(1);
      return;
    }
    this.startLevel(0);
  }

  private get phase(): PhaseId {
    return this.level === 0 ? 'tutorial' : 'main';
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
      locked: this.isLocked(index),
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
    const stageIs = (...stages: HoleStage[]) => this.holes.some((h) => stages.includes(h.stage));
    // 각 영역은 그 영역으로 굴릴 수 있는 구멍이 있을 때만 보인다(튜토리얼은 속재료 전 굴리기를 받지 않는다).
    const shared = this.sharedZone;
    const w1Stages: HoleStage[] = this.phase === 'tutorial' ? ['filled'] : shared ? ['cooking', 'cooked', 'filled', 'rolled'] : ['cooking', 'cooked', 'filled'];
    return {
      phase: this.phase,
      level: this.level,
      fumedCount: this.fumedCount,
      fumedLimit: FUMED_LIMIT,
      holes,
      tray: [...this.tray],
      barPosition: trianglePosition(this.barCycles),
      barZones: { w1: stageIs(...w1Stages) ? this.zoneW1 : null, w2: !shared && stageIs('rolled') ? this.zoneW2 : null, shared },
      fune: [...this.fune],
      funeServing: this.fune.length >= FUNE_SIZE,
      holding: this.holding,
      customers: this.guests.map(toStatus),
      activeDialogues,
      reviews: [...this.reviews],
      sessionAverage: sessionAverage(this.reviews),
      shopScore: this.shopScore,
      bestShopScore: this.best,
      combo: this.combo,
      rush: this.rushRemaining === null ? null : { remainingSec: this.rushRemaining },
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
    this.barCycles += dt / difficulty(this.level).periodSec;
    this.tickHoles(dt);
    for (const g of [...this.guests]) {
      if (this.isFinished) return; // 패배로 끝났으면 남은 손님은 더 처리하지 않는다
      this.tickDialogue(g, dt);
      this.tickPatience(g, dt);
    }
    if (this.isFinished) return;
    const speed = this.rushRemaining === null ? 1 : 2; // 러시 아워에는 입장 대기가 2배속으로 흐른다
    this.tickRush(dt);
    this.tickSpawns(dt * speed);
    this.tickFune(dt); // 서빙·전환으로 새로 생긴 손님과 타이머에는 이번 dt를 흘리지 않는다
    this.advanceTutorial();
  }

  // ── 구멍 ──────────────────────────────────────────────

  /** 1~5단계는 영역 하나를 굴리기 1·2가 함께 쓴다(튜토리얼은 고정 영역 둘이라 해당 없음). */
  private get sharedZone(): boolean {
    return this.level > 0 && !difficulty(this.level).twoZones;
  }

  private zoneOf(h: Hole): RollZone | null {
    // 익힘·익힘 완료 탭도 W1로 판정한다(속재료 전 굴리기). 튜토리얼은 이 탭을 거부하므로 영역이 없다.
    if (h.stage === 'cooking' || h.stage === 'cooked') return this.phase === 'tutorial' ? null : this.zoneW1;
    if (h.stage === 'filled') return this.zoneW1;
    if (h.stage === 'rolled') return this.sharedZone ? this.zoneW1 : this.zoneW2;
    return null;
  }

  /** 튜토리얼에서 쓰지 않는 구멍은 잠긴다. 본게임은 모두 열려 있다. */
  private isLocked(index: number): boolean {
    return this.phase === 'tutorial' && !TUTORIAL_HOLES.includes(index);
  }

  private tickHoles(dt: number): void {
    // 후네가 가득 차 서빙을 기다리는 동안은 탐 타이머가 멈춘다. 튜토리얼에는 탐 타이머가 없다.
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
    if (this.isLocked(e.hole)) return this.reject(e.hole, 'invalid-stage');
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
    if (this.isLocked(e.hole)) return this.reject(e.hole, 'invalid-stage');
    if (this.phase === 'tutorial') {
      const stage = this.tutorialStage();
      if (!((stage === 'roll-1' && hole.stage === 'filled') || (stage === 'roll-2' && hole.stage === 'rolled'))) return this.rejectTutorial(e.hole);
    }
    if (hole.stage === 'filled') return this.doRoll(e.hole, hole, 0);
    if (hole.stage === 'cooking' || hole.stage === 'cooked') {
      // 속재료 전 굴리기: 속 없음으로 고정되고 그 탭이 굴리기 1이다(판정은 W1).
      hole.noFilling = true;
      hole.cookElapsed = 0;
      return this.doRoll(e.hole, hole, 0);
    }
    if (hole.stage === 'rolled') return this.doRoll(e.hole, hole, 1);
    this.bus.emit('cook/tap-ignored', { hole: e.hole });
  }

  private doRoll(index: number, hole: Hole, nth: 0 | 1): void {
    // 판정은 누르는 순간의 공용 영역으로 한다. 영역은 굴려도 바뀌지 않고 단계 시작·가게 점수 경계에서만 다시 뽑는다.
    const hit = inZone(trianglePosition(this.barCycles), nth === 0 || this.sharedZone ? this.zoneW1 : this.zoneW2);
    hole.rollHits[nth] = hit;
    hole.stage = nth === 0 ? 'rolled' : 'done';
    if (nth === 1) hole.burnElapsed = 0;
    this.bus.emit('cook/rolled', { hole: index, hit });
    this.advanceTutorial();
  }

  private onPick(e: GameEvents['input/pick']): void {
    const hole = this.holes[e.hole];
    if (this.isFinished || hole === undefined) return;
    if (this.isLocked(e.hole)) return this.reject(e.hole, 'invalid-stage');
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
    // 후네가 차서 서빙을 기다리는 동안(연출 1초 포함)은 놓기를 거부하고 원래 구멍으로 되돌린다.
    if (this.fune.length >= FUNE_SIZE) return this.reject(index, 'fune-full');
    const item: FuneItem = {
      rolledPerfectly: hole.rollHits[0] === true && hole.rollHits[1] === true,
      filling: hole.filling,
      noFilling: hole.noFilling,
      dark: hole.stage === 'dark',
    };
    this.fune.push(item);
    this.funeHits.push(hole.rollHits.filter((x) => x === true).length);
    this.holes[index] = newHole();
    this.bus.emit('fune/added', { hole: index, item, count: this.fune.length });
    if (this.fune.length >= FUNE_SIZE) this.funeWait = FUNE_SERVE_DELAY_SEC;
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
      if (!TUTORIAL_HOLES.every((i) => RANK[(this.holes[i] as Hole).stage] >= step.minRank)) return;
      this.tutorialIndex++;
    }
  }

  private finishTutorial(): void {
    const review: ReviewResult = { source: 'tutorial', stars: 5, comment: this.data.tutorialComment, personality: null };
    this.reviews.push(review);
    this.tutorialCompleted = true;
    this.fune = [];
    this.funeHits = [];
    this.store.save({ version: 1, tutorialCompleted: true, finished: false, reviews: [...this.reviews] });
    this.bus.emit('review/issued', { review });
    this.startLevel(1);
  }

  // ── 후네·서빙 ─────────────────────────────────────────

  /** 후네가 찬 뒤 1초가 지나면 서빙(손님 0명 페이즈는 서빙 없이 비우고 전환)한다. */
  private tickFune(dt: number): void {
    if (this.fune.length < FUNE_SIZE || this.funeWait <= EPS) return;
    this.funeWait = Math.max(0, this.funeWait - dt);
    if (this.funeWait <= EPS) this.onFuneFull();
  }

  private onFuneFull(): void {
    if (this.phase === 'tutorial') return this.finishTutorial();
    if (phaseConfig(this.level).customerCount === 0) {
      // 손님이 없는 단계(1단계): 서빙 없이 후네를 비우고 전환한다. 가게 점수 기본은 시작 만족도다.
      this.scorePlate(null, START_SATISFACTION);
      this.fune = [];
      this.funeHits = [];
      this.plates++;
      return this.afterPlate();
    }
    this.tryServe();
  }

  /** 가득 찬 후네를 손님에게 서빙한다. 다시해줘를 요청한 손님이 우선이고, 그 밖에는 먼저 온 손님이다. */
  private tryServe(): void {
    if (this.fune.length < FUNE_SIZE || this.funeWait > EPS) return;
    const guest = this.guests.find((g) => g.awaitingRedo || g.group?.platesReceived === 1) ?? this.guests[0];
    if (guest !== undefined) this.serve(guest);
  }

  /**
   * 접시를 손님에게 서빙한다. 난수 순서(GDD §손님 대화): 어두워짐 상한 → 다시해줘 → 떠남 → 떠남 별점 → 맛보기 → (점수·경계 영역) → 식품 신고 → 리뷰 코멘트 → 트레이 셔플.
   * 조건이 안 맞으면 뽑지 않는다. 빼 주세요 위반으로 화난 손님 수가 한도에 닿으면 처리를 마친 직후 판이 끝난다.
   */
  private serve(g: Guest): void {
    this.serveInner(g);
    if (this.pendingDefeat && !this.isFinished) {
      this.bus.emit('session/game-over', { reason: 'fumed', fumedCount: this.fumedCount });
      this.finish();
    }
  }

  private serveInner(g: Guest): void {
    const items = this.fune;
    const ctx: PlateContext = { order: g.order, avoid: g.avoid };
    const defects = plateDefects(items, ctx);
    let sat = g.satisfaction;
    for (const d of plateChanges(items, ctx)) sat = applySatisfaction(sat, d);
    let stars = starsFromSatisfaction(sat);

    const cap = darkCapRange(items.filter((i) => i.dark).length);
    if (cap !== null) stars = Math.min(stars, cap.min + 0.5 * randomIndex((cap.max - cap.min) / 0.5 + 1, this.rng));

    // 단체 손님은 다시해줘·0~1점 떠남을 판정하지 않는다.
    const redo = g.group === null && !g.redoUsed && stars <= REDO_MAX_STARS && this.rng() < REDO_CHANCE;
    let walkedOutStars: number | null = null;
    if (g.group === null && !redo && stars <= WALKOUT_MAX_STARS && this.rng() < WALKOUT_CHANCE) walkedOutStars = 0.5 * randomIndex(3, this.rng);

    const kinds: readonly TasteKind[] = defects.length > 0 ? defects : ['perfect'];
    const lines = kinds.map((defect) => {
      const pool = this.data.tasteLines[g.personality][defect];
      return { defect, text: pool[randomIndex(pool.length, this.rng)] ?? '' };
    });

    this.bus.emit('plate/tasted', { customerId: g.id, defects: defects as readonly PlateDefect[], lines });
    if (g.order !== null) this.bus.emit('order/resolved', { customerId: g.id, success: orderSucceeded(items, g.order) });
    if (g.avoid !== null && allergyViolated(items, g.avoid)) {
      this.bus.emit('customer/allergy', { customerId: g.id, ingredient: g.avoid });
      this.angerByAllergy(g);
    }
    this.bus.emit('plate/scored', { customerId: g.id, delta: sat - START_SATISFACTION, stars });

    if (redo) {
      g.redoUsed = true;
      g.awaitingRedo = true;
      this.bus.emit('customer/redo-requested', { customerId: g.id });
      return this.clearFune();
    }

    const orderBonus = g.order !== null && orderSucceeded(items, g.order) ? ORDER_SCORE_BONUS : 0;
    this.scorePlate(g.id, sat, ctx, { orderBonus, vip: g.vip });
    let plateStars = walkedOutStars ?? stars;
    // 식품 신고: 지우개가 든 접시를 3%로. 점수·경계 영역 뽑기 뒤, 리뷰 코멘트 앞이다.
    let reported = false;
    if (hasEraser(items) && this.rng() < REPORT_CHANCE) {
      const r = reportedStars(plateStars);
      plateStars = r.stars;
      reported = true;
      this.bus.emit('plate/reported', { customerId: g.id, starsPenalty: r.penalty });
    }
    void reported;
    this.plates++;

    if (g.group !== null) {
      g.group.stars.push(plateStars);
      g.group.platesReceived++;
      if (g.group.platesReceived < GROUP_PLATES) {
        // 첫 접시: 리뷰·퇴장 없이 다음 접시를 기다린다.
        this.clearFune();
        return this.afterPlate();
      }
    }
    const finalStars = g.group === null ? plateStars : Math.round((g.group.stars.reduce((a, b) => a + b, 0) / g.group.stars.length) * 2) / 2;
    const comments = this.data.reviewComments(g.personality, commentBucket(finalStars));
    const review: ReviewResult = {
      source: 'customer',
      stars: finalStars,
      comment: comments[randomIndex(comments.length, this.rng)] ?? '',
      personality: g.personality,
    };
    if (walkedOutStars !== null) this.bus.emit('customer/walked-out', { customerId: g.id, stars: walkedOutStars });
    if (phaseConfig(this.level).countsReviews) this.reviews.push(review);
    this.bus.emit('review/issued', { review });
    this.guests = this.guests.filter((x) => x !== g);
    this.spawnTimers[g.slot] = REPLACEMENT_DELAY_SEC;
    this.bus.emit('customer/left', { customerId: g.id });
    this.clearFune();
    this.afterPlate();
  }

  /** 서빙하면 후네만 비운다(철판은 그대로). 서빙 시점에 트레이 위치를 셔플한다. */
  private clearFune(): void {
    this.fune = [];
    this.funeHits = [];
    this.tray = shuffle(TRAY_SOURCE, this.rng);
  }

  /** 접시 가게 점수를 더하고 score/plate를 낸다(튜토리얼·다시해줘 첫 접시에는 부르지 않는다). */
  private scorePlate(customerId: string | null, base: number, ctx: PlateContext = {}, extra: { orderBonus?: number; vip?: boolean } = {}): void {
    const hits = this.funeHits.reduce((a, b) => a + b, 0);
    const r = shopPlateScore(base, hits, isPerfectPlate(this.fune, ctx), this.combo, extra);
    this.combo = r.combo;
    this.shopScore += r.points;
    this.bus.emit('score/plate', { customerId, points: r.points, hits, combo: r.combo, multiplier: r.multiplier });
    // 러시 아워: 12단계부터, 가게 점수가 1000의 배수 경계를 넘으면 30초(한 접시로 여러 경계를 넘어도 한 번, 진행 중에는 다시 시작하지 않는다).
    // 12단계 전에 넘은 경계는 소급하지 않는다(구간은 항상 갱신한다).
    const rushBand = Math.floor(this.shopScore / RUSH_SCORE_STEP);
    if (rushBand > this.rushBand) {
      this.rushBand = rushBand;
      if (this.level >= RUSH_FROM_LEVEL && this.rushRemaining === null) {
        this.rushRemaining = RUSH_DURATION_SEC;
        this.bus.emit('rush/started', { durationSec: RUSH_DURATION_SEC });
      }
    }
    // 가게 점수가 200의 배수 경계를 넘으면(한 접시로 여러 개를 넘어도 한 번) 영역을 다시 뽑는다.
    const band = Math.floor(this.shopScore / ZONE_SCORE_STEP);
    if (band > this.zoneBand) {
      this.zoneBand = band;
      this.redrawZones();
    }
  }

  private tickRush(dt: number): void {
    if (this.rushRemaining === null) return;
    this.rushRemaining -= dt;
    if (this.rushRemaining <= EPS) this.endRush();
  }

  private endRush(): void {
    if (this.rushRemaining === null) return;
    this.rushRemaining = null;
    this.bus.emit('rush/ended', {});
  }

  private afterPlate(): void {
    // 빼 주세요 위반으로 패배가 정해졌으면 다음 단계를 시작하지 않는다(serve가 접시 처리 직후 판을 끝낸다).
    if (this.pendingDefeat || this.plates < targetPlates(this.level)) return;
    this.startLevel(this.level + 1);
  }

  private finish(): void {
    this.isFinished = true;
    this.endRush();
    this.guests = [];
    this.spawnTimers = [];
    this.store.save({ version: 1, tutorialCompleted: true, finished: true, reviews: [...this.reviews] });
    // 최고 가게 점수는 세션 종료 때 한 번 갱신한다(점수 0은 기록하지 않는다).
    if (this.shopScore > 0 && this.shopScore > (this.best ?? -1)) {
      this.bestStore.save(this.shopScore);
      this.bus.emit('score/new-best', { score: this.shopScore, previous: this.best });
    }
  }

  /**
   * 현재 단계 규칙으로 영역을 뽑는다. 튜토리얼은 고정, 1~5단계는 영역 1개(굴리기 1·2 공용), 6단계부터 W1 → W2 순서다.
   * 부르는 때: 단계가 시작될 때(폭이 바뀐다)와 가게 점수가 200의 배수 경계를 넘을 때.
   */
  private redrawZones(): void {
    const d = difficulty(this.level);
    if (this.level === 0) {
      this.zoneW1 = TUTORIAL_ZONE;
      this.zoneW2 = TUTORIAL_ZONE;
    } else if (!d.twoZones) {
      this.zoneW1 = drawZone(d.w1, this.rng);
      this.zoneW2 = this.zoneW1;
    } else {
      this.zoneW1 = this.drawTwoZone('w1');
      this.zoneW2 = this.drawTwoZone('w2');
    }
  }

  /** 두 영역 단계(6~)의 영역을 뽑는다. 폭과 중심 최소 거리는 난이도 곡선을 따른다. */
  private drawTwoZone(which: 'w1' | 'w2'): RollZone {
    const d = difficulty(this.level);
    return drawZoneAwayFromCenter(which === 'w1' ? d.w1 : d.w2, d.minCenterDistance, this.rng);
  }

  private startLevel(level: number): void {
    this.level = level;
    this.plates = 0;
    this.guests = [];
    this.spawnTimers = phaseConfig(level).dialogueIntervalsSec.map((_, slot) => (slot === 0 ? 0 : SECOND_CUSTOMER_DELAY_SEC));
    this.redrawZones();
    this.bus.emit('phase/changed', { phase: this.phase, level });
    this.tickSpawns(0);
  }

  // ── 손님·대화·인내 ────────────────────────────────────

  /** 손님이 앞으로 더 받아야 하는 접시 수(일반 1, 단체는 남은 수). */
  private remainingPlates(g: Guest): number {
    return g.group === null ? 1 : GROUP_PLATES - g.group.platesReceived;
  }

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
    const level = this.level;
    for (const slot of due) {
      // 서빙이 단계를 넘겼거나 입장한 손님이 받은 접시로 패배가 정해졌으면 남은 입장은 버린다.
      if (this.level !== level || this.isFinished || this.pendingDefeat) return;
      // 입장 조건: 서빙한 접시 수 + 손님들이 더 받을 접시 수 + 새 손님이 받을 접시 수 ≤ 목표(일반 1개).
      const committed = this.plates + this.guests.reduce((n, g) => n + this.remainingPlates(g), 0);
      if (committed + 1 <= targetPlates(level)) this.spawn(slot, targetPlates(level) - committed);
    }
  }

  /** 난수 순서(GDD §손님 대화): 성격 → 인내 → (10단계~) 주문 여부 → 재료 → 개수 → (13단계~) 빼 주세요 여부 → 재료 → (15단계~, 주문 없을 때) 단체 여부 → (17단계~) VIP 여부. */
  private spawn(slot: number, roomPlates: number): void {
    if (this.isFinished) return; // 판이 끝났으면 입장하지 않는다
    const intervalSec = phaseConfig(this.level).dialogueIntervalsSec[slot] ?? 0;
    const personality = PERSONALITIES[randomIndex(PERSONALITIES.length, this.rng)] as Personality;
    const { patienceMinSec, patienceMaxSec } = difficulty(this.level);
    let patienceTotal = patienceMinSec + this.rng() * (patienceMaxSec - patienceMinSec);

    let order: Guest['order'] = null;
    if (this.level >= ORDER_FROM_LEVEL && this.rng() < orderChance(this.level)) {
      const ingredient = NON_OCTOPUS[randomIndex(NON_OCTOPUS.length, this.rng)] as IngredientId;
      order = { ingredient, count: ORDER_COUNTS[randomIndex(ORDER_COUNTS.length, this.rng)] as 1 | 3 | 6 };
    }
    let avoid: IngredientId | null = null;
    if (this.level >= AVOID_FROM_LEVEL && this.rng() < AVOID_CHANCE) {
      const pool = NON_OCTOPUS.filter((i) => i !== order?.ingredient); // 주문 재료와 겹치지 않는다
      avoid = pool[randomIndex(pool.length, this.rng)] as IngredientId;
    }
    // 단체는 주문 없는 손님에게만. 뽑았어도 남은 목표가 1개뿐이면 일반 손님이다(난수는 이미 썼다).
    const groupRolled = this.level >= GROUP_FROM_LEVEL && order === null && this.rng() < GROUP_CHANCE;
    const group = groupRolled && roomPlates >= GROUP_PLATES ? { platesReceived: 0, stars: [] as number[] } : null;
    const vip = this.level >= VIP_FROM_LEVEL && this.rng() < VIP_CHANCE;

    // 인내 배율: 러시 아워 중 입장 ×1.5, 단체 ×1.6, VIP ×0.7(해당하는 것을 모두 곱한다).
    if (this.rushRemaining !== null) patienceTotal *= RUSH_PATIENCE_MULTIPLIER;
    if (group !== null) patienceTotal *= GROUP_PATIENCE_MULTIPLIER;
    if (vip) patienceTotal *= VIP_PATIENCE_MULTIPLIER;

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
      order,
      avoid,
      group,
      vip,
    };
    this.guests.push(guest);
    this.bus.emit('customer/entered', { customer: toStatus(guest) });
    this.tryServe();
  }

  /** 경과 비율에 맞춰 얼굴 단계를 올린다(되돌아가지 않는다). */
  private syncFace(g: Guest): number {
    const ratio = Math.min(1, (g.patienceElapsed + EPS) / g.patienceTotal);
    const target = ratio >= ANGRY_AT ? 2 : ratio >= ANNOYED_AT ? 1 : 0;
    for (let face = FACES.indexOf(g.face) + 1; face <= target; face++) {
      g.face = FACES[face] as PatienceLevel;
      this.bus.emit('customer/patience-changed', { customerId: g.id, face: g.face });
    }
    return ratio;
  }

  private tickPatience(g: Guest, dt: number): void {
    g.patienceElapsed += dt;
    const ratio = this.syncFace(g);
    if (ratio >= 1 && !g.patienceExpired) {
      g.patienceExpired = true; // 손님은 떠나지 않고 만족도 -20을 한 번만 받는다
      g.satisfaction = applySatisfaction(g.satisfaction, PATIENCE_EXPIRED);
      this.bus.emit('customer/fumed', { customerId: g.id });
      if (this.phase !== 'tutorial' && ++this.fumedCount >= FUMED_LIMIT) {
        this.bus.emit('session/game-over', { reason: 'fumed', fumedCount: this.fumedCount });
        this.finish();
      }
    }
  }

  /**
   * 빼 주세요 위반: 그 손님이 즉시 화난다(인내 100%, 얼굴 빨강, 화난 손님 수 +1). 만족도는 접시의 -40 하나로 끝내므로
   * 인내 100% -20은 더하지 않는다. 이미 화난 손님이면 화난 손님 수를 늘리지 않는다. 한도에 닿으면 접시 처리 뒤 판이 끝난다.
   */
  private angerByAllergy(g: Guest): void {
    if (g.patienceExpired) return;
    g.patienceExpired = true;
    g.patienceElapsed = g.patienceTotal;
    this.syncFace(g);
    this.bus.emit('customer/fumed', { customerId: g.id });
    if (++this.fumedCount >= FUMED_LIMIT) this.pendingDefeat = true;
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

/** 공개 상태에는 만족도를 담지 않는다(점수 비공개). 주문·특별 손님 필드는 입장 때 정해진 값이다. */
const toStatus = (g: Guest): CustomerStatus => ({
  id: g.id,
  personality: g.personality,
  dialogueIntervalSec: g.intervalSec,
  patience: Math.min(1, g.patienceElapsed / g.patienceTotal),
  face: g.face,
  awaitingRedo: g.awaitingRedo,
  order: g.order,
  avoid: g.avoid,
  group: g.group === null ? null : { platesNeeded: GROUP_PLATES, platesReceived: g.group.platesReceived },
  vip: g.vip,
});
