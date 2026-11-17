// sandbox.html?state=<name> 진입점. 상태 이름 목록은 sandbox.states.json과 같아야 한다.
import type { CookStep, Customer, Doneness, GameState, HoleState, Ingredient, IngredientId } from '../contracts';
import { createRenderer } from './index';

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
  tutorialCompleted: true,
};

const STATES: Readonly<Record<string, GameState>> = {
  'griddle-empty': { ...base, tray: [] },
  'steps-early': { ...base, holes: [hole(0, 'margarine'), hole(1, 'batter'), hole(2, 'cook-1', 0.5), hole(3, 'filling'), hole(4, 'cook-2', 0.5, 'octopus'), hole(5, 'roll-1')] },
  'steps-late': { ...base, holes: [hole(0, 'roll-2'), hole(1, 'roll-3'), hole(2, 'done'), hole(3, 'done', 0, null, ['burnt']), hole(4, 'roll-1', 0, null, ['under']), hole(5, 'margarine')] },
  doneness: { ...base, holes: [0, 0.2, 0.45, 0.7, 0.9, 1].map((g, i) => hole(i, 'cook-1', g)) },
  fillings: { ...base, holes: IDS.map((id, i) => hole(i, 'cook-2', 0.3, id)) },
  customers: { ...base, customers: [customer('c1', 'salaryman'), customer('c2', 'grandma')] },
};

const name = new URLSearchParams(location.search).get('state') ?? 'griddle-empty';
const state = STATES[name];
const app = document.getElementById('app');
if (app === null) throw new Error('#app 없음');
if (state === undefined) {
  app.innerHTML = `<div id="err">알 수 없는 state: ${name.replace(/[<>&]/g, '')}<br>가능: ${Object.keys(STATES).join(', ')}</div>`;
} else {
  createRenderer(app).render(state);
}
