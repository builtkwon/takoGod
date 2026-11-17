import type { EventBus, GameEventType } from '../contracts';

type AnyHandler = (payload: never) => void;

/** 동기 EventBus. main이 다른 구현을 넘겨도 되고, 테스트·시뮬레이션은 이것을 쓴다. */
export function createEventBus(): EventBus {
  const handlers = new Map<GameEventType, Set<AnyHandler>>();
  return {
    on(type, handler) {
      const set = handlers.get(type) ?? new Set<AnyHandler>();
      set.add(handler);
      handlers.set(type, set);
      return () => {
        set.delete(handler);
      };
    },
    emit(type, payload) {
      for (const h of [...(handlers.get(type) ?? [])]) (h as (p: typeof payload) => void)(payload);
    },
  };
}
