import { PerspectiveCamera, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { DURATION, admit, createEffects } from '../effects';
import { createOutline } from '../toon';

/** 슬롯마다 scene.children에 [폭죽, 물음표, 분노]가 순서대로 들어 있다. */
function setup() {
  const scene = new Scene();
  const fx = createEffects(scene, new PerspectiveCamera(), createOutline());
  const vis = (slot: number) => ({ fw: scene.children[slot * 3]!.visible, q: scene.children[slot * 3 + 1]!.visible, anger: scene.children[slot * 3 + 2]!.visible });
  return { fx, vis };
}
const at = (slot: number) => (id: string) => (id === 'a' ? slot : -1);

describe('이펙트는 손님 id를 매 프레임 따라간다', () => {
  it('앞 손님이 나가 슬롯이 바뀌면 이펙트도 새 슬롯으로 옮겨 간다', () => {
    const { fx, vis } = setup();
    fx.trigger('confused', 'a', 0, { mark: 'anger', seed: 1 });
    fx.update(100, at(1));
    expect(vis(1).anger).toBe(true);
    fx.update(200, at(0));
    expect(vis(0).anger).toBe(true);
    expect(vis(1).anger).toBe(false);
  });

  it('손님이 사라지면 이펙트를 끝내고 다시 나타나도 되살리지 않는다', () => {
    const { fx, vis } = setup();
    fx.trigger('firework', 'a', 0, { seed: 1 });
    fx.update(100, at(0));
    expect(vis(0).fw).toBe(true);
    fx.update(200, at(-1));
    expect(vis(0).fw).toBe(false);
    fx.update(300, at(0));
    expect(vis(0).fw).toBe(false);
  });

  it('길이(초)가 지나면 끝난다', () => {
    const { fx, vis } = setup();
    fx.trigger('confused', 'a', 0, { mark: 'question' });
    fx.update(100, at(0));
    expect(vis(0).q).toBe(true);
    fx.update(DURATION.confused * 1000 + 1, at(0));
    expect(vis(0).q).toBe(false);
  });
});

describe('fumed 화면 흔들림은 손님과 무관하다', () => {
  it('손님이 없어도 0.4초 흔들리고 분노 표시는 없다, 그 뒤엔 멈춘다', () => {
    const { fx, vis } = setup();
    fx.trigger('fumed', 'gone', 0);
    const [dx, dy] = fx.update(100, at(-1));
    expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0);
    expect(vis(0).anger || vis(1).anger).toBe(false);
    expect(fx.update(DURATION.shake * 1000 + 1, at(-1))).toEqual([0, 0]);
  });

  it('손님이 있으면 흔들림과 분노 표시가 같이 나온다', () => {
    const { fx, vis } = setup();
    fx.trigger('fumed', 'a', 0);
    const [dx, dy] = fx.update(100, at(1));
    expect(Math.abs(dx) + Math.abs(dy)).toBeGreaterThan(0);
    expect(vis(1).anger).toBe(true);
  });
});

describe('대기 요청 시작 규칙(admit)', () => {
  it('id가 없으면 firework·confused는 버리고 fumed만 시작한다', () => {
    expect(admit('firework', false)).toBe(false);
    expect(admit('confused', false)).toBe(false);
    expect(admit('fumed', false)).toBe(true);
    expect(admit('firework', true)).toBe(true);
  });
});
