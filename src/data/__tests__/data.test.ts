// GDD §콘텐츠 수량 대조: 대사 성격당 10(총 40), 리뷰 코멘트 성격당 별점 구간 5×3, 튜토리얼 안내 7, 맛보기 반응 40
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Personality, TasteKind, TutorialStage } from '../../contracts';
import { dialogues, reviewComments, tasteLines, tutorialReviewComment, tutorialStepsV2 } from '../index';

const PERSONALITIES: readonly Personality[] = ['salaryman', 'grandma', 'gourmet', 'tourist'];

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

  it('튜토리얼 5★ 코멘트가 있다', () => {
    expect(tutorialReviewComment.trim()).not.toBe('');
  });
});

describe('굽기 개편 콘텐츠(GDD §콘텐츠)', () => {
  const KINDS: readonly TasteKind[] = ['no-filling', 'trap', 'dark', 'roll-miss', 'perfect'];
  const STAGES: readonly TutorialStage[] = ['margarine', 'batter', 'cook-wait', 'filling', 'roll-1', 'roll-2', 'fune'];

  it('맛보기 반응은 성격 4 × 종류 5 × 2개, 모두 비어 있지 않고 서로 다르다', () => {
    const all: string[] = [];
    for (const p of PERSONALITIES) {
      for (const k of KINDS) {
        const list = tasteLines[p][k];
        expect(list).toHaveLength(2);
        for (const t of list) expect(t.trim()).not.toBe('');
        all.push(...list);
      }
    }
    expect(all).toHaveLength(40);
    expect(new Set(all).size).toBe(40);
  });

  it('튜토리얼 안내문구는 7단계 각각 하나', () => {
    expect(tutorialStepsV2.map((s) => s.stage)).toEqual(STAGES);
    for (const s of tutorialStepsV2) expect(s.message.trim()).not.toBe('');
  });

  it('금지어가 없다(dialogue-banned-words.txt 기준)', () => {
    const banned = readFileSync('harness/scripts/dialogue-banned-words.txt', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('!'));
    const texts = [...Object.values(tasteLines).flatMap((p) => Object.values(p).flat()), ...tutorialStepsV2.map((s) => s.message)];
    for (const t of texts) for (const w of banned) expect(t.toLowerCase()).not.toContain(w.toLowerCase());
  });
});
