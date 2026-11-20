// 테스트 보조: 이벤트 버스·picker·view 스텁. vi.mock 없이 주입한다.
import type { EventBus, GameEventType, GameEvents, GameStateV2, HoleStage, HoleStateV2, PickTarget, ScenePicker } from '../../../contracts';
import type { DragView, GhostLook, Pt } from '../controller';

export function stubBus(): EventBus & { readonly sent: { type: GameEventType; payload: unknown }[] } {
  const handlers = new Map<GameEventType, ((p: never) => void)[]>();
  const sent: { type: GameEventType; payload: unknown }[] = [];
  return {
    sent,
    on(type, handler) {
      const list = handlers.get(type) ?? [];
      list.push(handler as (p: never) => void);
      handlers.set(type, list);
      return () => handlers.set(type, (handlers.get(type) ?? []).filter((h) => h !== handler));
    },
    emit<K extends GameEventType>(type: K, payload: GameEvents[K]) {
      sent.push({ type, payload });
      for (const h of handlers.get(type) ?? []) h(payload as never);
    },
  };
}

export const hole = (index: number, stage: HoleStage = 'empty'): HoleStateV2 => ({
  index, locked: false, stage, cookElapsedSec: 0, burnElapsedSec: 0, filling: null, noFilling: false, rollHits: [null, null], rollZone: null, warn: false,
});

export function stateOf(stages: readonly HoleStage[], over: Partial<GameStateV2> = {}): GameStateV2 {
  return {
    phase: 'P1', holes: stages.map((s, i) => hole(i, s)), tray: [{ id: 'octopus', isTrap: false }, { id: 'wasabi', isTrap: true }],
    barPosition: 0.5, barZones: { w1: null, w2: null }, fune: [], funeServing: false, holding: null, customers: [], activeDialogues: [], reviews: [], sessionAverage: null,
    tutorialCompleted: true, tutorialStage: null, ...over,
  };
}

/** 좌표 → 대상 표(x 100 단위 구멍, y 500 후네, y 300 트레이). anchor는 대상별 고정 좌표. */
export function stubPicker(): ScenePicker {
  return {
    pick(x, y): PickTarget | null {
      if (y >= 500) return { kind: 'fune' };
      if (y >= 300) return { kind: 'tray', slot: Math.floor(x / 100) };
      if (y >= 100) return { kind: 'hole', index: Math.floor(x / 100) };
      return null;
    },
    anchor(t) {
      if (t.kind === 'hole') return { x: t.index * 100 + 50, y: 150 };
      if (t.kind === 'tray') return t.slot < 2 ? { x: t.slot * 100 + 50, y: 350 } : null;
      return { x: 200, y: 550 };
    },
  };
}

export type ViewCall = readonly [string, ...unknown[]];
export function stubView(): DragView & { readonly calls: ViewCall[] } {
  const calls: ViewCall[] = [];
  return {
    calls,
    ghostStart: (look: GhostLook, at: Pt) => void calls.push(['ghostStart', look.kind, at]),
    ghostMove: (at: Pt) => void calls.push(['ghostMove', at]),
    ghostEnd: () => void calls.push(['ghostEnd']),
    fly: (look: GhostLook, from: Pt, to: Pt) => void calls.push(['fly', look.kind, from, to]),
    fall: (look: GhostLook, at: Pt) => void calls.push(['fall', look.kind, at]),
  };
}
