// sandbox.html?state=<name> 진입점. 상태 이름 목록은 sandbox.states.json과 같아야 한다.
import type { CookStep, Customer, CustomerStatus, Doneness, FuneItem, GameState, GameStateV2, HoleStage, HoleStateV2, HoleState, Ingredient, IngredientId, PatienceLevel } from '../contracts';
import { createRenderer } from './index';
import type { RenderExtra } from './renderer';
import type { BakeStage } from './models';

const IDS: readonly IngredientId[] = ['octopus', 'wasabi', 'raw-garlic', 'eraser', 'marshmallow', 'chili'];
const ing = (id: IngredientId): Ingredient => ({ id, isTrap: id !== 'octopus' });
const hole = (index: number, step: CookStep, gauge = 0, filling: IngredientId | null = null, judgements: readonly Doneness[] = []): HoleState => ({
  index,
  step,
  gauge,
  filling,
  judgements,
});
const customer = (id: string, personality: Customer['personality']): Customer => ({ id, personality, satisfaction: 60, dialogueIntervalSec: 12 });

const base: GameState = {
  phase: 'P1',
  holes: Array.from({ length: 6 }, (_, i) => hole(i, 'margarine')),
  tray: IDS.map(ing),
  customers: [],
  activeDialogues: [],
  reviews: [],
  sessionAverage: null,
  tutorialCompleted: true,
};

const done6 = { ...base, holes: Array.from({ length: 6 }, (_, i) => hole(i, 'done')) };

const STATES: Readonly<Record<string, GameState>> = {
  'griddle-empty': { ...base, tray: [] },
  'steps-early': { ...base, holes: [hole(0, 'margarine'), hole(1, 'batter'), hole(2, 'cook-1', 0.5), hole(3, 'filling'), hole(4, 'cook-2', 0.5, 'octopus'), hole(5, 'roll-1')] },
  'steps-late': { ...base, holes: [hole(0, 'roll-2'), hole(1, 'roll-3'), hole(2, 'done'), hole(3, 'done', 0, null, ['burnt']), hole(4, 'roll-1', 0, null, ['under']), hole(5, 'margarine')] },
  doneness: { ...base, holes: [0, 0.2, 0.45, 0.7, 0.9, 1].map((g, i) => hole(i, 'cook-1', g)) },
  fillings: { ...base, holes: IDS.map((id, i) => hole(i, 'cook-2', 0.3, id)) },
  'fune-empty': done6,
  'fune-full': done6,
  'hole-dark': done6,
  'hole-burnt': done6,
  customers: { ...base, customers: [customer('c1', 'salaryman'), customer('c2', 'grandma')] },
};

// 색 단계·후네는 GameState 밖의 표시 정보라 RenderExtra로 따로 준다.
const stages = (...s: BakeStage[]): RenderExtra => ({ stages: s });
const EXTRAS: Readonly<Record<string, RenderExtra>> = {
  'fune-empty': {},
  'fune-full': { fune: ['normal', 'normal', 'normal', 'normal', 'normal', 'normal'] },
  'hole-dark': stages('normal', 'dark', 'dark', 'normal', 'dark', 'normal'),
  'hole-burnt': stages('normal', 'dark', 'burnt', 'burnt', 'dark', 'normal'),
};

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
  ...o,
});
const holes2 = (...hs: (HoleStage | HoleStateV2)[]): readonly HoleStateV2[] => hs.map((h, i) => (typeof h === 'string' ? h2(i, h) : { ...h, index: i }));
const status = (id: string, personality: Customer['personality'], face: PatienceLevel): CustomerStatus => ({
  id,
  personality,
  dialogueIntervalSec: 12,
  patience: face === 'normal' ? 0.2 : face === 'annoyed' ? 0.6 : 0.9,
  face,
  awaitingRedo: false,
});
const item = (dark: boolean): FuneItem => ({ rolledPerfectly: true, filling: 'octopus', noFilling: false, dark });

const base2: GameStateV2 = {
  phase: 'P1',
  holes: holes2('empty', 'empty', 'empty', 'empty', 'empty', 'empty'),
  tray: IDS.map(ing),
  barPosition: 0.5,
  barZone: null,
  fune: [],
  holding: null,
  customers: [],
  activeDialogues: [],
  reviews: [],
  sessionAverage: null,
  tutorialCompleted: true,
  tutorialStage: null,
};
const faces = (face: PatienceLevel): GameStateV2 => ({ ...base2, customers: [status('c1', 'salaryman', face), status('c2', 'grandma', face)] });
const rim: GameStateV2 = {
  ...base2,
  holes: holes2('cooked', 'done', 'dark', h2(3, 'done', { warn: true }), h2(4, 'dark', { warn: true }), 'cooking'),
};

const STATES2: Readonly<Record<string, GameStateV2>> = {
  // 트레이는 표시 순서가 셔플된 것(고추·문어·마시멜로·와사비 4칸).
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
  'v2-face-normal': faces('normal'),
  'v2-face-annoyed': faces('annoyed'),
  'v2-face-angry': faces('angry'),
};
// 깜빡임 위상: 'v2-rim'은 켜짐, 'v2-rim-off'는 꺼짐(BLINK_MS 반주기 단위 시각).
const NOW: Readonly<Record<string, number>> = { 'v2-rim': 0, 'v2-rim-off': 250 };

const name = new URLSearchParams(location.search).get('state') ?? 'griddle-empty';
const state = STATES[name];
const state2 = STATES2[name];
const app = document.getElementById('app');
if (app === null) throw new Error('#app 없음');
if (state === undefined && state2 === undefined) {
  app.innerHTML = `<div id="err">알 수 없는 state: ${name.replace(/[<>&]/g, '')}<br>가능: ${[...Object.keys(STATES), ...Object.keys(STATES2)].join(', ')}</div>`;
} else if (state2 !== undefined) {
  createRenderer(app).renderV2(state2, NOW[name] ?? 0);
} else if (state !== undefined) {
  createRenderer(app).render(state, EXTRAS[name]);
}
