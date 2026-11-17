import type { CookStep } from '../contracts';

/** 도구바 버튼. 익히기·굴리기는 여러 굽기 단계를 한 버튼이 맡는다. */
export interface Tool {
  readonly label: string;
  readonly steps: readonly [CookStep, ...CookStep[]];
}

export const TOOLS: readonly Tool[] = [
  { label: '마가린', steps: ['margarine'] },
  { label: '반죽물', steps: ['batter'] },
  { label: '익히기', steps: ['cook-1', 'cook-2'] },
  { label: '속재료', steps: ['filling'] },
  { label: '굴리기', steps: ['roll-1', 'roll-2', 'roll-3'] },
  { label: '완성', steps: ['done'] },
];

/** 버튼을 눌렀을 때 보낼 단계. 구멍의 다음 단계가 이 도구 소속이면 그 단계, 아니면 도구의 첫 단계(core가 순서 외 탭으로 처리). */
export function stepForTool(tool: Tool, current: CookStep): CookStep {
  return tool.steps.includes(current) ? current : tool.steps[0];
}

export function toolForStep(step: CookStep): Tool | undefined {
  return TOOLS.find((t) => t.steps.includes(step));
}
