import { describe, expect, it } from 'vitest';
import { averageText, phaseLabel, starsText } from './format';
import { stepForTool, TOOLS, toolForStep } from './tools';

describe('format', () => {
  it('starsText: 0.5 단위', () => {
    expect(starsText(5)).toBe('★★★★★');
    expect(starsText(4.5)).toBe('★★★★½');
    expect(starsText(1)).toBe('★');
    expect(starsText(4.96)).toBe('★★★★★');
    expect(starsText(4.9)).toBe('★★★★★');
    expect(starsText(4.7)).toBe('★★★★½');
  });
  it('phaseLabel', () => {
    expect(phaseLabel('tutorial')).toBe('튜토리얼');
    expect(phaseLabel('P3')).toBe('3단계');
  });
  it('averageText: 소수 첫째 자리', () => {
    expect(averageText(5)).toBe('5.0');
    expect(averageText(2.75)).toBe('2.8');
    expect(averageText(NaN)).toBe('-');
  });
});

describe('tools', () => {
  it('굽기 9단계가 모두 어떤 도구에 속한다', () => {
    for (const s of ['margarine', 'batter', 'cook-1', 'filling', 'cook-2', 'roll-1', 'roll-2', 'roll-3', 'done'] as const) {
      expect(toolForStep(s)).toBeDefined();
    }
  });
  it('stepForTool: 소속이면 현재 단계, 아니면 도구 첫 단계', () => {
    const roll = TOOLS.find((t) => t.label === '굴리기')!;
    expect(stepForTool(roll, 'roll-2')).toBe('roll-2');
    expect(stepForTool(roll, 'margarine')).toBe('roll-1');
  });
});
