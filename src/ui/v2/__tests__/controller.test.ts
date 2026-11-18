import { describe, expect, it } from 'vitest';
import type { HoleStage } from '../../../contracts';
import { createController, DRAG_THRESHOLD } from '../controller';
import { stateOf, stubBus, stubPicker, stubView } from './helpers';

function setup(stages: readonly HoleStage[] = ['empty', 'done', 'cooked']) {
  const bus = stubBus();
  const view = stubView();
  let state = stateOf(stages);
  const c = createController({ bus, picker: stubPicker(), getState: () => state, view });
  return { bus, view, c, setState: (s: typeof state) => (state = s), types: () => bus.sent.map((e) => e.type) };
}
const BUCKET = { material: { kind: 'margarine' } as const, origin: { x: 10, y: 10 } };

describe('재료 끌어 놓기', () => {
  it('통에서 끌어 구멍에 놓으면 input/place-material', () => {
    const { c, bus } = setup();
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.move(1, { x: 60, y: 150 });
    c.up(1, { x: 60, y: 150 });
    expect(bus.sent).toEqual([{ type: 'input/place-material', payload: { hole: 0, material: { kind: 'margarine' } } }]);
  });

  it('구멍이 아닌 곳에 놓으면 이벤트 없이 원위치 연출만', () => {
    const { c, bus, view } = setup();
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.up(1, { x: 60, y: 20 });
    expect(bus.sent).toEqual([]);
    expect(view.calls.at(-1)).toEqual(['fly', 'margarine', { x: 60, y: 20 }, { x: 10, y: 10 }]);
  });

  it('트레이 칸에서 집으면 그 칸의 재료를 속재료로 보낸다', () => {
    const { c, bus } = setup();
    c.down(1, { x: 150, y: 350 }); // 슬롯 1 = wasabi
    c.up(1, { x: 250, y: 150 });
    expect(bus.sent[0]).toEqual({ type: 'input/place-material', payload: { hole: 2, material: { kind: 'filling', ingredient: 'wasabi' } } });
  });

  it('빈 트레이 칸은 집지 않는다', () => {
    const { c, view } = setup();
    c.down(1, { x: 250, y: 350 }); // 슬롯 2 = 없음
    expect(view.calls).toEqual([]);
  });

  it('거부되면 출처로 날아 되돌아간다(끄는 사이 트레이가 섞이면 현재 칸으로)', () => {
    const { c, bus, view, setState } = setup();
    c.down(1, { x: 150, y: 350 }); // wasabi
    setState(stateOf(['empty', 'done', 'cooked'], { tray: [{ id: 'wasabi', isTrap: true }, { id: 'octopus', isTrap: false }] }));
    c.up(1, { x: 60, y: 150 });
    bus.emit('cook/rejected', { hole: 0, reason: 'invalid-stage' });
    expect(view.calls.at(-1)).toEqual(['fly', 'filling', { x: 50, y: 150 }, { x: 50, y: 350 }]);
  });
});

describe('구멍 탭·들기', () => {
  it('문턱 안 이동은 탭: input/roll', () => {
    const { c, bus } = setup();
    c.down(1, { x: 150, y: 150 });
    c.move(1, { x: 150 + DRAG_THRESHOLD - 1, y: 150 });
    c.up(1, { x: 150, y: 150 });
    expect(bus.sent).toEqual([{ type: 'input/roll', payload: { hole: 1 } }]);
  });

  it('완성 구멍을 문턱 넘게 끌면 input/pick, 후네에 놓으면 drop fune', () => {
    const { c, bus, view } = setup();
    c.down(1, { x: 150, y: 150 });
    c.move(1, { x: 150, y: 150 + DRAG_THRESHOLD });
    c.move(1, { x: 200, y: 520 });
    c.up(1, { x: 200, y: 520 });
    expect(bus.sent).toEqual([
      { type: 'input/pick', payload: { hole: 1 } },
      { type: 'input/drop', payload: { target: 'fune' } },
    ]);
    expect(view.calls[0]).toEqual(['ghostStart', 'done', expect.anything()]);
  });

  it('후네 밖에 놓으면 drop other, cook/dropped에서 놓은 위치에서 떨어진다', () => {
    const { c, bus, view } = setup();
    c.down(1, { x: 150, y: 150 });
    c.move(1, { x: 150, y: 200 });
    c.up(1, { x: 20, y: 400 });
    expect(bus.sent.at(-1)).toEqual({ type: 'input/drop', payload: { target: 'other' } });
    bus.emit('cook/dropped', { hole: 1, item: 'done' });
    expect(view.calls.at(-1)).toEqual(['fall', 'done', { x: 20, y: 400 }]);
  });

  it('익힘 중인 구멍은 끌어도 pick을 보내지 않고 탭도 아니다', () => {
    const { c, bus } = setup();
    c.down(1, { x: 250, y: 150 }); // cooked
    c.move(1, { x: 250, y: 250 });
    c.up(1, { x: 250, y: 250 });
    expect(bus.sent).toEqual([]);
  });

  it('pick이 거부되면 들던 것이 구멍으로 돌아가고 이후 입력은 버린다', () => {
    const { c, bus, view } = setup();
    c.down(1, { x: 150, y: 150 });
    c.move(1, { x: 150, y: 220 });
    bus.emit('cook/rejected', { hole: 1, reason: 'already-holding' });
    c.up(1, { x: 200, y: 520 });
    expect(bus.sent.map((e) => e.type)).toEqual(['input/pick', 'cook/rejected']);
    expect(view.calls.at(-1)).toEqual(['fly', 'done', { x: 150, y: 220 }, { x: 150, y: 150 }]);
  });

  it('후네가 가득 차 drop이 거부되면 놓은 위치에서 구멍으로 돌아간다', () => {
    const { c, bus, view } = setup();
    c.down(1, { x: 150, y: 150 });
    c.move(1, { x: 150, y: 220 });
    c.up(1, { x: 200, y: 520 });
    bus.emit('cook/rejected', { hole: 1, reason: 'fune-full' });
    expect(view.calls.at(-1)).toEqual(['fly', 'done', { x: 200, y: 520 }, { x: 150, y: 150 }]);
  });

  it('포인터 취소는 drop cancel', () => {
    const { c, types } = setup();
    c.down(1, { x: 150, y: 150 });
    c.move(1, { x: 150, y: 220 });
    c.cancel();
    expect(types()).toEqual(['input/pick', 'input/drop']);
  });

  it('들기 전 취소는 아무것도 보내지 않는다', () => {
    const { c, types } = setup();
    c.down(1, { x: 150, y: 150 });
    c.cancel();
    expect(types()).toEqual([]);
  });
});

describe('동시 1개', () => {
  it('끌고 있는 동안 다른 포인터는 무시한다', () => {
    const { c, bus } = setup();
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.down(2, { x: 150, y: 150 });
    c.up(2, { x: 150, y: 150 });
    expect(bus.sent).toEqual([]);
    c.up(1, { x: 60, y: 150 });
    expect(bus.sent).toHaveLength(1);
  });
});
