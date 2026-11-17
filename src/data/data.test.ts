// GDD §콘텐츠 수량 대조: 대사 성격당 10(총 40), 리뷰 코멘트 성격당 별점 구간 5×3, 튜토리얼 안내 9
import { describe, expect, it } from 'vitest';
import type { CookStep, Personality } from '../contracts';
import { dialogues, reviewComments, tutorialReviewComment, tutorialSteps } from './index';

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];
const STEPS: readonly CookStep[] = ['margarine', 'batter', 'cook-1', 'filling', 'cook-2', 'roll-1', 'roll-2', 'roll-3', 'done'];

describe('콘텐츠 수량(GDD §콘텐츠)', () => {
  it('대사는 총 40문항, 성격당 10문항', () => {
    expect(dialogues).toHaveLength(40);
    for (const p of PERSONALITIES) expect(dialogues.filter((d) => d.personality === p)).toHaveLength(10);
  });

  it('리뷰 코멘트는 성격당 별점 1~5 구간마다 3개, 모두 비어 있지 않다', () => {
    for (const p of PERSONALITIES) {
      for (const band of [1, 2, 3, 4, 5] as const) {
        const list = reviewComments[p][band];
        expect(list).toHaveLength(3);
        for (const c of list) expect(c.trim()).not.toBe('');
      }
    }
  });

  it('튜토리얼 안내문구는 굽기 9단계 각각 하나, 5★ 코멘트 1개', () => {
    expect(tutorialSteps.map((s) => s.target)).toEqual(STEPS);
    for (const s of tutorialSteps) expect(s.message.trim()).not.toBe('');
    expect(tutorialReviewComment.trim()).not.toBe('');
  });
});
