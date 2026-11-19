// 포인터 → 입력 이벤트 변환. 규칙을 판단하지 않는다: 좌표를 picker로 바꿔 input/*만 보내고, 결과(거부·떨어짐)는 core 이벤트로 받아 연출만 시킨다.
// DOM을 모른다(화면 그리기는 DragView). 원본: docs/GDD.md §굽기
import type { EventBus, GameStateV2, IngredientId, Material, ScenePicker } from '../../contracts';

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** 손가락 아래·날아가는 것의 모양. */
export type GhostKind = 'margarine' | 'batter' | 'filling' | 'done' | 'dark' | 'burnt';
export interface GhostLook {
  readonly kind: GhostKind;
  readonly ingredient?: IngredientId;
}

/** 끌기·되돌리기·떨어짐 연출. DOM 구현은 effects.ts. */
export interface DragView {
  ghostStart(look: GhostLook, at: Pt): void;
  ghostMove(at: Pt): void;
  ghostEnd(): void;
  /** from에서 to로 날아가 사라진다. */
  fly(look: GhostLook, from: Pt, to: Pt): void;
  /** at에서 아래로 떨어져 화면 밖으로 사라진다. */
  fall(look: GhostLook, at: Pt): void;
}

/** 마가린 통·반죽 주전자(DOM). origin은 되돌아갈 자리다. */
export interface BucketSource {
  readonly material: Extract<Material, { kind: 'margarine' | 'batter' }>;
  readonly origin: Pt;
}

export interface Controller {
  down(pointerId: number, at: Pt, bucket?: BucketSource): void;
  move(pointerId: number, at: Pt): void;
  up(pointerId: number, at: Pt): void;
  /** 포인터 취소·앱 백그라운드 전환. */
  cancel(): void;
  dispose(): void;
}

/** 탭과 끌기를 가르는 이동 거리(CSS px). */
export const DRAG_THRESHOLD = 10;

type Active =
  | { readonly type: 'material'; readonly id: number; readonly material: Material; readonly origin: Pt | (() => Pt | null); readonly look: GhostLook; readonly painted: Set<number>; accepted: number }
  | { type: 'hole'; readonly id: number; readonly hole: number; readonly start: Pt; moved: boolean; rolled: boolean; picked: boolean; pos: Pt; look: GhostLook | null };

/** 마지막으로 core에 보낸 조작. 거부·떨어짐 이벤트가 왔을 때 어디서 어디로 그릴지 정한다. */
type Last =
  | { readonly type: 'place'; readonly hole: number; readonly look: GhostLook; readonly origin: Pt | (() => Pt | null) }
  | { readonly type: 'drop'; readonly hole: number; readonly look: GhostLook; readonly at: Pt };

const HELD: ReadonlySet<string> = new Set(['done', 'dark', 'burnt']);
/** 끌어 칠하는 재료가 들어가는 구멍 단계. */
const PAINT_STAGE = { margarine: 'empty', batter: 'greased' } as const;
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const resolve = (p: Pt | (() => Pt | null)): Pt | null => (typeof p === 'function' ? p() : p);

export function createController(deps: {
  readonly bus: EventBus;
  readonly picker: ScenePicker;
  readonly getState: () => GameStateV2;
  readonly view: DragView;
}): Controller {
  const { bus, picker, getState, view } = deps;
  let active: Active | null = null;
  let last: Last | null = null;

  const lookOf = (m: Material): GhostLook => (m.kind === 'filling' ? { kind: 'filling', ingredient: m.ingredient } : { kind: m.kind });

  const onRejected = ({ hole }: { hole: number }): void => {
    const anchor = picker.anchor({ kind: 'hole', index: hole });
    if (active?.type === 'hole' && active.picked && active.hole === hole && active.look) {
      // 들자마자 거부(이미 들고 있음·튜토리얼): 들고 있던 것을 구멍으로 돌려보내고 이후 포인터 입력은 버린다.
      view.ghostEnd();
      if (anchor) view.fly(active.look, active.pos, anchor);
      active = null;
      return;
    }
    if (active?.type === 'material' && active.painted.has(hole)) active.accepted -= 1; // 칠하다 거부(튜토리얼 단계 등): 채운 것으로 세지 않는다
    if (last?.hole !== hole) return;
    if (last.type === 'place') {
      const to = resolve(last.origin);
      if (anchor && to) view.fly(last.look, anchor, to);
    } else if (anchor) view.fly(last.look, last.at, anchor);
    last = null;
  };

  const onDropped = ({ hole, item }: { hole: number; item: 'done' | 'dark' | 'burnt' }): void => {
    const at = last?.type === 'drop' && last.hole === hole ? last.at : picker.anchor({ kind: 'hole', index: hole });
    if (at) view.fall({ kind: item }, at);
    last = null;
  };

  /** 마가린·반죽: 손가락이 지나간 구멍마다 한 번씩 보낸다. 단계가 안 맞는 구멍은 조용히 건너뛴다. */
  const paint = (a: Extract<Active, { type: 'material' }>, at: Pt): void => {
    if (a.material.kind !== 'margarine' && a.material.kind !== 'batter') return;
    const t = picker.pick(at.x, at.y);
    if (t?.kind !== 'hole' || a.painted.has(t.index) || getState().holes[t.index]?.stage !== PAINT_STAGE[a.material.kind]) return;
    a.painted.add(t.index);
    a.accepted += 1;
    bus.emit('input/place-material', { hole: t.index, material: a.material });
  };

  const offs = [bus.on('cook/rejected', onRejected), bus.on('cook/dropped', onDropped)];

  return {
    down(id, at, bucket) {
      if (active) return; // 들기·끌기는 동시에 1개
      last = null;
      if (bucket) {
        const look = lookOf(bucket.material);
        active = { type: 'material', id, material: bucket.material, origin: bucket.origin, look, painted: new Set(), accepted: 0 };
        view.ghostStart(look, at);
        return;
      }
      const t = picker.pick(at.x, at.y);
      if (t?.kind === 'tray') {
        const ing = getState().tray[t.slot];
        if (!ing) return;
        const material: Material = { kind: 'filling', ingredient: ing.id };
        // 끄는 사이 트레이가 섞여도 같은 재료의 현재 칸으로 되돌린다.
        const origin = (): Pt | null => {
          const slot = getState().tray.findIndex((x) => x.id === ing.id);
          return slot < 0 ? null : picker.anchor({ kind: 'tray', slot });
        };
        const look = lookOf(material);
        active = { type: 'material', id, material, origin, look, painted: new Set(), accepted: 0 };
        view.ghostStart(look, at);
      } else if (t?.kind === 'hole') {
        active = { type: 'hole', id, hole: t.index, start: at, moved: false, rolled: false, picked: false, pos: at, look: null };
        // 들 수 없는 구멍(굴릴 수 있는 단계 포함)은 누르는 순간 굴린다: 판정이 손가락을 뗄 때까지 늦으면 통과 구간(W1 약 0.12초)을 놓친다.
        if (!HELD.has(getState().holes[t.index]?.stage ?? '')) {
          bus.emit('input/roll', { hole: t.index });
          active.rolled = true;
        }
      }
    },

    move(id, at) {
      if (!active || active.id !== id) return;
      if (active.type === 'material') {
        view.ghostMove(at);
        return paint(active, at);
      }
      if (active.rolled) return; // 이미 굴렸다: 그 뒤 끌어도 들지 않는다
      active.pos = at;
      if (active.picked) return view.ghostMove(at);
      if (dist(at, active.start) < DRAG_THRESHOLD) return;
      active.moved = true;
      const stage = getState().holes[active.hole]?.stage;
      if (!stage || !HELD.has(stage)) return; // 그 밖의 구멍은 끌 수 없다: 탭도 아니다
      active.picked = true;
      active.look = { kind: stage as 'done' | 'dark' | 'burnt' };
      bus.emit('input/pick', { hole: active.hole });
      // pick이 거부되면 같은 틱에 onRejected가 active를 비운다.
      if (active) view.ghostStart(active.look ?? { kind: 'done' }, at);
    },

    up(id, at) {
      const a = active;
      if (!a || a.id !== id) return;
      if (a.type === 'material') {
        view.ghostEnd();
        const t = picker.pick(at.x, at.y);
        if (a.material.kind !== 'filling') {
          paint(a, at);
          active = null; // 거부 이벤트가 paint 안에서 동기로 오므로 그 뒤에 비운다
          if (a.accepted <= 0) {
            const to = resolve(a.origin);
            if (to) view.fly(a.look, at, to);
          }
        } else if (t?.kind === 'hole') {
          active = null;
          last = { type: 'place', hole: t.index, look: a.look, origin: a.origin };
          bus.emit('input/place-material', { hole: t.index, material: a.material });
        } else {
          // 구멍이 아니면 core에 알릴 것이 없다. 원위치 연출만 한다.
          active = null;
          const to = resolve(a.origin);
          if (to) view.fly(a.look, at, to);
        }
        return;
      }
      active = null;
      if (a.picked && a.look) {
        view.ghostEnd();
        const target = picker.pick(at.x, at.y)?.kind === 'fune' ? 'fune' : 'other';
        last = { type: 'drop', hole: a.hole, look: a.look, at };
        bus.emit('input/drop', { target });
        return;
      }
      if (!a.moved && !a.rolled) bus.emit('input/roll', { hole: a.hole });
    },

    cancel() {
      const a = active;
      active = null;
      if (!a) return;
      view.ghostEnd();
      if (a.type === 'hole' && a.picked) bus.emit('input/drop', { target: 'cancel' });
    },

    dispose() {
      offs.forEach((off) => off());
    },
  };
}
