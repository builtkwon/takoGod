import { describe, expect, it } from 'vitest';
import { averageText, phaseLabel, starsText } from '../format';

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
    expect(phaseLabel('tutorial', 0)).toBe('튜토리얼');
    expect(phaseLabel('main', 1)).toBe('1단계');
    expect(phaseLabel('main', 20)).toBe('20단계');
    expect(phaseLabel('main', 37)).toBe('37단계');
  });
  it('averageText: 소수 첫째 자리', () => {
    expect(averageText(5)).toBe('5.0');
    expect(averageText(2.75)).toBe('2.8');
    expect(averageText(NaN)).toBe('-');
  });
});
