// 도구 연결 규약. 원본: docs/harness-design.md §3, §5
// 하네스 도구(sim.balance, render.snapshot, dialogue.lint)가 아래 경로의 export를 이 타입으로 읽는다.

import type { DialogueLine } from './customer';

/** 밸런스 시뮬레이션 시나리오. GDD §밸런스 목표와 대응한다. */
export interface BalanceScenario {
  /** 'perfect' = 전정답 + 완벽 굽기, 'random' = 무작위 플레이 */
  readonly kind: 'perfect' | 'random';
  /** 시뮬레이션할 세션 수. */
  readonly sessions: number;
  /** 재현용 난수 시드. */
  readonly seed: number;
}

/** 시나리오 → 평균 별점. */
export interface BalanceSimulator {
  run(scenario: BalanceScenario): number;
}

/** `src/core/sim.ts`의 모양. */
export interface SimModule {
  readonly BalanceSimulator: BalanceSimulator;
}

/** `src/render/sandbox.states.json`의 모양: sandbox.html?state=<name>에 쓰는 상태 이름 배열. */
export type SandboxStates = readonly string[];

/** `src/data/dialogues.ts`의 모양. */
export interface DialoguesModule {
  readonly dialogues: readonly DialogueLine[];
}

export const TOOL_ENTRY_PATHS = {
  sim: 'src/core/sim.ts',
  sandboxPage: 'src/render/sandbox.html',
  sandboxStates: 'src/render/sandbox.states.json',
  dialogues: 'src/data/dialogues.ts',
} as const;
