// 직렬 연출 대기열. 점수 공개 순서(맛보기 반응 → 별점 → 다시해줘·떠남 → 리뷰 카드)를 이벤트 도착 순서대로 보장한다.

/** run이 함수를 돌려주면 holdMs 뒤에 부른다(정리용). */
export type Step = () => (() => void) | void;

export interface Sequencer {
  push(run: Step, holdMs: number): void;
  clear(): void;
}

export interface Clock {
  readonly set: (fn: () => void, ms: number) => unknown;
  readonly clear: (handle: unknown) => void;
}

const REAL_CLOCK: Clock = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export function createSequencer(clock: Clock = REAL_CLOCK): Sequencer {
  const queue: { run: Step; holdMs: number }[] = [];
  let running = false;
  let timer: unknown;
  let cleanup: (() => void) | void;

  const next = (): void => {
    cleanup?.();
    cleanup = undefined;
    const item = queue.shift();
    if (!item) {
      running = false;
      return;
    }
    running = true;
    cleanup = item.run();
    timer = clock.set(next, item.holdMs);
  };

  return {
    push(run, holdMs) {
      queue.push({ run, holdMs });
      if (!running) next();
    },
    clear() {
      clock.clear(timer);
      queue.length = 0;
      cleanup?.();
      cleanup = undefined;
      running = false;
    },
  };
}
