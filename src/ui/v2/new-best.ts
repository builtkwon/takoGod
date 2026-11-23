import type { EventBus } from '../../contracts';

/** 결과 화면의 "최고 기록!" 표시용. 세션 종료 때 core가 한 번 내는 score/new-best를 기억하고, 다시 하기 때 초기화해 다음 판에 남지 않게 한다. */
export function trackNewBest(bus: EventBus, disposers: (() => void)[]): { readonly value: () => boolean; readonly reset: () => void } {
  let flag = false;
  disposers.push(bus.on('score/new-best', () => (flag = true)));
  return { value: () => flag, reset: () => (flag = false) };
}
