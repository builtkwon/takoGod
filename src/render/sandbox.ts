// sandbox.html?state=<name> 진입점. 상태 이름 목록은 sandbox.states.json과 같아야 한다.
import type { CustomerStatus, FuneItem, GameStateV2, HoleStage, HoleStateV2, Ingredient, IngredientId, PatienceLevel, Personality } from '../contracts';
import { createRenderer } from './index';
import type { EffectKind, MarkKind } from './index';

const IDS: readonly IngredientId[] = ['octopus', 'wasabi', 'raw-garlic', 'eraser', 'marshmallow', 'chili'];
const ing = (id: IngredientId): Ingredient => ({ id, isTrap: id !== 'octopus' });

// --- V2(GameStateV2) 상태 ---------------------------------------------------
const h2 = (index: number, stage: HoleStage, o: Partial<HoleStateV2> = {}): HoleStateV2 => ({
  index,
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
/** 16구로 채운다(모자란 칸은 빈 구멍). */
const holes2 = (...hs: (HoleStage | HoleStateV2)[]): readonly HoleStateV2[] =>
  Array.from({ length: 16 }, (_, i) => {
    const h = hs[i] ?? 'empty';
    return typeof h === 'string' ? h2(i, h) : { ...h, index: i };
  });
const status = (id: string, personality: Personality, face: PatienceLevel): CustomerStatus => ({
  id,
  personality,
  dialogueIntervalSec: 12,
  patience: face === 'normal' ? 0.2 : face === 'annoyed' ? 0.6 : 0.9,
  face,
  awaitingRedo: false,
});
const item = (dark: boolean): FuneItem => ({ rolledPerfectly: true, filling: 'octopus', noFilling: false, dark });

const base2: GameStateV2 = {
  phase: 'main',
  level: 1,
  fumedCount: 0,
  fumedLimit: 4,
  holes: holes2(),
  tray: IDS.map(ing),
  barPosition: 0.5,
  barZones: { w1: null, w2: null, shared: true },
  shopScore: 0,
  bestShopScore: null,
  combo: 0,
  seatCount: 2,
  rush: null,
  fune: [],
  funeServing: false,
  holding: null,
  customers: [],
  activeDialogues: [],
  reviews: [],
  sessionAverage: null,
  tutorialCompleted: true,
  tutorialStage: null,
};
const faces = (face: PatienceLevel): GameStateV2 => ({ ...base2, customers: [status('c1', 'salaryman', face), status('c2', 'grandma', face)] });
/** n명(1~4)이 나란히 선 상태: 자리 수도 n으로 둔다. 얼굴은 번갈아 보여 구분한다. */
const seats = (n: number): GameStateV2 => ({
  ...base2,
  seatCount: n,
  customers: Array.from({ length: n }, (_, i) => status(`c${i + 1}`, i % 2 === 0 ? 'salaryman' : 'grandma', (['normal', 'annoyed', 'angry'] as const)[i % 3]!)),
});
const rim: GameStateV2 = {
  ...base2,
  holes: holes2('cooked', 'done', 'dark', h2(3, 'done', { warn: true }), h2(4, 'dark', { warn: true }), 'cooking'),
};

const lockedHoles = holes2(
  ...Array.from({ length: 16 }, (_, i): HoleStateV2 => {
    const open = [1, 2, 5, 6, 9, 10].includes(i);
    return h2(i, open ? (i === 2 ? 'cooked' : i === 6 ? 'done' : 'greased') : 'empty', { locked: !open, filling: i === 6 ? 'octopus' : null });
  }),
);

const STATES: Readonly<Record<string, GameStateV2>> = {
  // 트레이는 표시 순서가 셔플된 것(고추·문어·마시멜로·와사비 4칸). 16구에 9단계를 골고루 둔다.
  'v2-holes-a': {
    ...base2,
    tray: (['chili', 'octopus', 'marshmallow', 'wasabi'] as const).map(ing),
    holes: holes2(
      'greased',
      h2(1, 'cooking', { cookElapsedSec: 1.5 }),
      'cooked',
      h2(3, 'filled', { filling: 'octopus' }),
      h2(4, 'rolled', { filling: 'octopus', rollHits: [true, null] }),
      h2(5, 'done', { filling: 'octopus', rollHits: [true, true] }),
      'empty',
      'greased',
      h2(8, 'cooking', { cookElapsedSec: 0.4 }),
      'cooked',
      h2(10, 'filled', { filling: 'wasabi' }),
      h2(11, 'rolled', { filling: 'octopus', rollHits: [true, null] }),
      h2(12, 'done', { filling: 'octopus', rollHits: [true, true] }),
      h2(13, 'dark', { filling: 'octopus' }),
      h2(14, 'burnt', { filling: 'octopus' }),
      'empty',
    ),
  },
  // 0 dark, 1 burnt, 2 속 없음(굴림 1), 3 속 없음(완성), 4 빈칸, 5 들고 있음(숨김)
  'v2-holes-b': {
    ...base2,
    holding: 5,
    holes: holes2('dark', 'burnt', h2(2, 'rolled', { noFilling: true }), h2(3, 'done', { noFilling: true }), 'empty', 'done'),
  },
  'v2-rim': rim,
  'v2-rim-off': rim,
  'v2-fune': { ...base2, tray: [], fune: [item(false), item(false), item(true), item(false), item(true)] },
  // 후네 6알 + 서빙 대기: 가쓰오부시
  'v2-katsuo': { ...base2, funeServing: true, fune: [item(false), item(false), item(false), item(false), item(false), item(false)] },
  // 튜토리얼: 열린 6구(1,2,5,6,9,10) 외 10구는 잠금(어둡게)
  'v2-lock': { ...base2, holes: lockedHoles, tutorialCompleted: false, tutorialStage: 'margarine' },
  'v2-face-normal': faces('normal'),
  'v2-face-annoyed': faces('annoyed'),
  'v2-face-angry': faces('angry'),
  'v2-seats-1': seats(1),
  'v2-seats-2': seats(2),
  'v2-seats-3': seats(3),
  'v2-seats-4': seats(4),
  'v2-fx-firework': faces('normal'),
  'v2-fx-confused-q': faces('annoyed'),
  'v2-fx-confused-anger': faces('annoyed'),
  'v2-fx-fumed': faces('angry'),
};
// 깜빡임 위상: 'v2-rim'은 켜짐, 'v2-rim-off'는 꺼짐(BLINK_MS 반주기 단위 시각).
const NOW: Readonly<Record<string, number>> = { 'v2-rim': 0, 'v2-rim-off': 250, 'v2-katsuo': 100 };
/** 이펙트 상태: 어느 손님에게 무엇을, 시작 후 몇 초 시점으로 고정해 그린다(스냅샷 결정성). seed로 모양을 고정한다. */
const FX: Readonly<Record<string, { kind: EffectKind; id: string; t: number; mark?: MarkKind }>> = {
  'v2-fx-firework': { kind: 'firework', id: 'c1', t: 0.35 },
  'v2-fx-confused-q': { kind: 'confused', id: 'c2', t: 0.7, mark: 'question' },
  'v2-fx-confused-anger': { kind: 'confused', id: 'c2', t: 0.7, mark: 'anger' },
  'v2-fx-fumed': { kind: 'fumed', id: 'c1', t: 0.12 },
};

const name = new URLSearchParams(location.search).get('state') ?? 'v2-holes-a';
const state = STATES[name];
const app = document.getElementById('app');
if (app === null) throw new Error('#app 없음');
if (state === undefined) {
  app.innerHTML = `<div id="err">알 수 없는 state: ${name.replace(/[<>&]/g, '')}<br>가능: ${Object.keys(STATES).join(', ')}</div>`;
} else {
  const r = createRenderer(app);
  const params = new URLSearchParams(location.search);
  const fx = FX[name];
  if (params.get('live') === '1') {
    // 실시간 확인: 이펙트를 눌러 보는 버튼 + 계속 그린다(스냅샷은 live 없이 고정 시점).
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:8px;left:8px;display:flex;gap:6px;z-index:9';
    for (const [kind, mark] of [['firework'], ['confused', 'question'], ['confused', 'anger'], ['fumed']] as const) {
      const b = document.createElement('button');
      b.textContent = mark === undefined ? kind : `${kind}-${mark}`;
      b.onclick = () => r.effect(kind, 'c1', { startMs: performance.now(), mark });
      bar.append(b);
    }
    document.body.append(bar);
    const loop = (now: number) => {
      r.renderV2(state, now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else if (fx !== undefined) {
    r.effect(fx.kind, fx.id, { startMs: 0, seed: 7, mark: fx.mark });
    r.renderV2(state, fx.t * 1000);
  } else {
    r.renderV2(state, NOW[name] ?? 0);
  }
}
