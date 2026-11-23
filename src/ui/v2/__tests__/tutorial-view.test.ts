// 타이틀 표시 중에는 튜토리얼 안내·화살표·동작 문구가 hidden이다. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTutorialView } from '../tutorial-view';
import { stateOf, stubBus, stubPicker } from './helpers';

class FakeEl {
  className = '';
  textContent = '';
  hidden = false;
  offsetWidth = 0;
  style: Record<string, string> = {};
  classList = { add: () => {}, remove: () => {} };
  append(): void {}
}

afterEach(() => vi.unstubAllGlobals());

describe('튜토리얼 표시 보류', () => {
  it('타이틀 표시 중에는 .ui-arrow-label·안내·화살표가 hidden, 시작 뒤 나타난다', () => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const made: FakeEl[] = [];
    const layer = { append: (...c: FakeEl[]) => made.push(...c) } as unknown as HTMLElement;
    const view = createTutorialView(layer, stubBus(), stubPicker(), { margarine: () => ({ x: 5, y: 5 }), batter: () => ({ x: 395, y: 5 }) }, []);
    const pick = (cls: string): FakeEl => made.find((e) => e.className.includes(cls))!;
    const state = stateOf(['empty', 'empty'], { phase: 'tutorial', tutorialStage: 'margarine' });

    view.setSuspended(true);
    view.update(state);
    for (const c of ['ui-arrow-label', 'ui-guide', 'ui-arrow']) expect(pick(c).hidden).toBe(true);

    view.setSuspended(false);
    view.update(state);
    expect(pick('ui-arrow-label').hidden).toBe(false);
    expect(pick('ui-guide').hidden).toBe(false);
  });
});
