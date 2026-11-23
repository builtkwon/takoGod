// 버전 라벨: 값이 있으면 그대로, 없거나 빈 문자열이면 표시하지 않는다. DOM 라이브러리가 없어 최소 가짜 요소를 쓴다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showTitle, versionTag } from '../screens';

afterEach(() => vi.unstubAllGlobals());

describe('versionTag', () => {
  it('라벨이 있으면 그대로 담은 요소, 없거나 빈 문자열이면 null', () => {
    vi.stubGlobal('document', { createElement: () => ({ className: '', textContent: '' }) });
    const tag = versionTag('v0.1.0 · abc1234');
    expect(tag).toMatchObject({ className: 'ui-version', textContent: 'v0.1.0 · abc1234' });
    expect(versionTag(undefined)).toBeNull();
    expect(versionTag('')).toBeNull();
  });
});

describe('showTitle 선택', () => {
  class FakeEl {
    className = '';
    textContent = '';
    children: FakeEl[] = [];
    handlers: (() => void)[] = [];
    append(...c: FakeEl[]): void {
      this.children.push(...c);
    }
    remove(): void {}
    addEventListener(_: string, h: () => void): void {
      this.handlers.push(h);
    }
  }
  const run = (opts?: { tutorialButton?: boolean }) => {
    vi.stubGlobal('document', { createElement: () => new FakeEl() });
    const layer = new FakeEl();
    const p = showTitle(layer as unknown as HTMLElement, undefined, opts);
    const buttons = layer.children[0]!.children.filter((c) => c.handlers.length > 0);
    return { p, buttons };
  };

  it('튜토리얼 버튼이 없으면 시작 하나, 누르면 start', async () => {
    const { p, buttons } = run();
    expect(buttons.map((b) => b.textContent)).toEqual(['시작']);
    buttons[0]!.handlers[0]!();
    await expect(p).resolves.toBe('start');
  });
  it('tutorialButton이면 시작 아래에 튜토리얼 버튼, 각각 start·tutorial', async () => {
    const a = run({ tutorialButton: true });
    expect(a.buttons.map((b) => b.textContent)).toEqual(['시작', '튜토리얼']);
    a.buttons[1]!.handlers[0]!();
    await expect(a.p).resolves.toBe('tutorial');
    const b = run({ tutorialButton: true });
    b.buttons[0]!.handlers[0]!();
    await expect(b.p).resolves.toBe('start');
  });
});
