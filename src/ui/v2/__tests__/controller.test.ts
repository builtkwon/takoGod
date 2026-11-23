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

describe('굴리기 판정 시점', () => {
  it.each(['cooking', 'cooked', 'filled', 'rolled'] as const)('%s 구멍은 누르는 순간 input/roll, 뗄 때 다시 보내지 않는다', (stage) => {
    const { c, bus } = setup([stage]);
    c.down(1, { x: 50, y: 150 });
    expect(bus.sent).toEqual([{ type: 'input/roll', payload: { hole: 0 } }]);
    c.up(1, { x: 50, y: 150 });
    expect(bus.sent).toHaveLength(1);
  });
  it('굴린 뒤 끌어도 pick하지 않는다', () => {
    const { c, bus } = setup(['filled']);
    c.down(1, { x: 50, y: 150 });
    c.move(1, { x: 50, y: 150 + DRAG_THRESHOLD * 3 });
    c.up(1, { x: 50, y: 300 });
    expect(bus.sent.map((e) => e.type)).toEqual(['input/roll']);
  });
  it('들 수 있는 구멍(done)은 누를 때 보내지 않고 탭이면 뗄 때 보낸다', () => {
    const { c, bus } = setup(['done']);
    c.down(1, { x: 50, y: 150 });
    expect(bus.sent).toEqual([]);
    c.up(1, { x: 50, y: 150 });
    expect(bus.sent).toEqual([{ type: 'input/roll', payload: { hole: 0 } }]);
  });
});

describe('마가린·반죽 끌어 칠하기', () => {
  const BATTER = { material: { kind: 'batter' } as const, origin: { x: 10, y: 10 } };
  const placed = (bus: ReturnType<typeof stubBus>) => bus.sent.filter((e) => e.type === 'input/place-material').map((e) => (e.payload as { hole: number }).hole);

  it('지나간 empty 구멍마다 한 번씩, 다시 지나가도 중복 없음, 단계 안 맞는 구멍은 건너뜀', () => {
    const { c, bus, view } = setup(['empty', 'cooked', 'empty', 'empty']);
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.move(1, { x: 50, y: 150 });
    c.move(1, { x: 60, y: 150 });
    c.move(1, { x: 150, y: 150 });
    c.move(1, { x: 250, y: 150 });
    c.move(1, { x: 50, y: 150 });
    c.up(1, { x: 350, y: 150 });
    expect(placed(bus)).toEqual([0, 2, 3]);
    expect(view.calls.some((x) => x[0] === 'fly')).toBe(false);
  });
  it('반죽은 greased 구멍만', () => {
    const { c, bus } = setup(['empty', 'greased', 'greased']);
    c.down(1, { x: 10, y: 10 }, BATTER);
    c.move(1, { x: 50, y: 150 });
    c.move(1, { x: 150, y: 150 });
    c.up(1, { x: 250, y: 150 });
    expect(placed(bus)).toEqual([1, 2]);
  });
  it('하나도 못 채우고 놓으면 원위치로 날아간다', () => {
    const { c, bus, view } = setup(['cooked']);
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.move(1, { x: 50, y: 150 });
    c.up(1, { x: 50, y: 150 });
    expect(bus.sent).toEqual([]);
    expect(view.calls.at(-1)).toEqual(['fly', 'margarine', { x: 50, y: 150 }, { x: 10, y: 10 }]);
  });
  it('전부 거부되면(튜토리얼) 채운 것으로 세지 않고 원위치로 날아간다', () => {
    const { c, bus, view } = setup(['empty']);
    bus.on('input/place-material', ({ hole }) => bus.emit('cook/rejected', { hole, reason: 'tutorial-step' }));
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.up(1, { x: 50, y: 150 });
    expect(view.calls.at(-1)).toEqual(['fly', 'margarine', { x: 50, y: 150 }, { x: 10, y: 10 }]);
  });
  it('속재료는 놓은 구멍 하나에만', () => {
    const { c, bus } = setup(['cooked', 'cooked']);
    c.down(1, { x: 50, y: 350 });
    c.move(1, { x: 50, y: 150 });
    c.move(1, { x: 150, y: 150 });
    c.up(1, { x: 150, y: 150 });
    expect(placed(bus)).toEqual([1]);
  });
});

describe('속재료 탭 선택', () => {
  const tapTray = (c: ReturnType<typeof setup>['c'], x = 50): void => {
    c.down(1, { x, y: 350 });
    c.up(1, { x, y: 350 });
  };
  it('트레이 칸 탭은 선택(이벤트 없음), 같은 칸 다시 탭은 해제', () => {
    const { c, bus } = setup(['cooked']);
    tapTray(c);
    expect(c.selected()).toBe('octopus');
    expect(bus.sent).toEqual([]);
    tapTray(c);
    expect(c.selected()).toBeNull();
  });
  it('다른 칸을 탭하면 선택이 바뀐다', () => {
    const { c } = setup(['cooked']);
    tapTray(c, 50);
    tapTray(c, 150);
    expect(c.selected()).toBe('wasabi');
  });
  it('선택 중 구멍 탭은 굴리기가 아니라 넣기이고 선택이 바로 풀린다', () => {
    const { c, bus } = setup(['cooked', 'cooked']);
    tapTray(c);
    c.down(1, { x: 150, y: 150 });
    c.up(1, { x: 150, y: 150 });
    expect(bus.sent).toEqual([{ type: 'input/place-material', payload: { hole: 1, material: { kind: 'filling', ingredient: 'octopus' } } }]);
    expect(c.selected()).toBeNull();
    c.down(1, { x: 50, y: 150 }); // 선택이 풀렸으니 이제는 굴리기
    expect(bus.sent.at(-1)).toEqual({ type: 'input/roll', payload: { hole: 0 } });
  });
  it('core가 넣기를 거부하면(함정 재료 등) 거부 연출: 재료가 트레이로 돌아감', () => {
    const { c, bus, view } = setup(['cooked']);
    tapTray(c);
    c.down(1, { x: 50, y: 150 });
    bus.emit('cook/rejected', { hole: 0, reason: 'tutorial-step' });
    expect(view.calls.at(-1)).toEqual(['fly', 'filling', { x: 50, y: 150 }, { x: 50, y: 350 }]);
  });
  it('빈 곳 탭은 선택 해제, 완성품 구멍 탭은 선택 유지', () => {
    const { c } = setup(['done', 'cooked']);
    tapTray(c);
    c.down(1, { x: 50, y: 150 }); // done 구멍: 들기 쪽 조작
    c.up(1, { x: 50, y: 150 });
    expect(c.selected()).toBe('octopus');
    c.down(1, { x: 50, y: 20 }); // 아무것도 없는 곳
    c.up(1, { x: 50, y: 20 });
    expect(c.selected()).toBeNull();
  });
  it('선택 중 넣을 수 없는 단계(filled·rolled) 구멍 탭은 굴리기로 넘기고 선택은 유지', () => {
    const { c, bus } = setup(['filled', 'rolled']);
    tapTray(c);
    c.down(1, { x: 50, y: 150 });
    c.up(1, { x: 50, y: 150 });
    c.down(1, { x: 150, y: 150 });
    c.up(1, { x: 150, y: 150 });
    expect(bus.sent).toEqual([
      { type: 'input/roll', payload: { hole: 0 } },
      { type: 'input/roll', payload: { hole: 1 } },
    ]);
    expect(c.selected()).toBe('octopus');
  });
  it('끌어 놓기는 그대로 동작하고 선택은 풀린다', () => {
    const { c, bus } = setup(['cooked']);
    tapTray(c, 150);
    c.down(1, { x: 50, y: 350 });
    c.move(1, { x: 50, y: 150 });
    c.up(1, { x: 50, y: 150 });
    expect(bus.sent).toEqual([{ type: 'input/place-material', payload: { hole: 0, material: { kind: 'filling', ingredient: 'octopus' } } }]);
    expect(c.selected()).toBeNull();
  });
});

describe('끌어 칠하기 보간', () => {
  it('pointermove 사이가 멀어도 사이의 구멍을 건너뛰지 않는다', () => {
    const { c, bus } = setup(['empty', 'empty', 'empty', 'empty', 'empty']);
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.move(1, { x: 50, y: 150 });
    c.move(1, { x: 450, y: 150 }); // 한 번에 구멍 4개를 지나는 빠른 쓸기
    c.up(1, { x: 450, y: 150 });
    expect(bus.sent.map((e) => (e.payload as { hole: number }).hole)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('잠긴 구멍·후네 서빙 대기', () => {
  it('칠하며 잠긴 구멍을 지나가면 조용히 건너뛴다', () => {
    const { c, bus, setState } = setup();
    const s = stateOf(['empty', 'empty']);
    setState({ ...s, holes: [{ ...s.holes[0]!, locked: true }, s.holes[1]!] });
    c.down(1, { x: 10, y: 10 }, BUCKET);
    c.move(1, { x: 50, y: 150 });
    c.up(1, { x: 150, y: 150 });
    expect(bus.sent.map((e) => (e.payload as { hole: number }).hole)).toEqual([1]);
  });
  it('잠긴 구멍을 눌러도 roll을 보내지 않는다', () => {
    const { c, bus, setState } = setup();
    const s = stateOf(['filled']);
    setState({ ...s, holes: [{ ...s.holes[0]!, locked: true }] });
    c.down(1, { x: 50, y: 150 });
    c.up(1, { x: 50, y: 150 });
    expect(bus.sent).toEqual([]);
  });
  it('후네 서빙 대기 중 후네에 놓아 거부되면 놓은 곳에서 원래 구멍으로 되돌린다', () => {
    const { c, bus, view, setState } = setup();
    setState(stateOf(['empty', 'done'], { funeServing: true }));
    c.down(1, { x: 150, y: 150 });
    c.move(1, { x: 150, y: 150 + DRAG_THRESHOLD });
    c.up(1, { x: 200, y: 520 });
    bus.emit('cook/rejected', { hole: 1, reason: 'fune-full' });
    expect(view.calls.at(-1)).toEqual(['fly', 'done', { x: 200, y: 520 }, { x: 150, y: 150 }]);
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

  it('굴릴 수 있는 구멍은 누를 때 roll만 보내고 끌어도 pick을 보내지 않는다', () => {
    const { c, bus } = setup();
    c.down(1, { x: 250, y: 150 }); // cooked
    c.move(1, { x: 250, y: 250 });
    c.up(1, { x: 250, y: 250 });
    expect(bus.sent).toEqual([{ type: 'input/roll', payload: { hole: 2 } }]);
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
