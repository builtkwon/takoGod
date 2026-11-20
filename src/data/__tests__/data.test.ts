// GDD §콘텐츠 수량 대조: 대사 성격당 10(총 40), 리뷰 코멘트 성격당 별점 구간 5×3, 튜토리얼 안내 7, 맛보기 반응 40
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Personality, TasteKind, TutorialStage } from '../../contracts';
import { dialogues, fumedLines, hudText, reviewComments, tasteLines, tutorialArrowHints, tutorialReviewComment, tutorialStepsV2 } from '../index';

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

  it('분노 대사는 성격 4 × 2개, 비어 있지 않고 서로 다르다', () => {
    const all = PERSONALITIES.flatMap((p) => [...fumedLines[p]]);
    expect(all).toHaveLength(8);
    for (const t of all) expect(t.trim()).not.toBe('');
    expect(new Set(all).size).toBe(8);
  });

  it('튜토리얼 안내문구는 7단계 각각 하나', () => {
    expect(tutorialStepsV2.map((s) => s.stage)).toEqual(STAGES);
    for (const s of tutorialStepsV2) expect(s.message.trim()).not.toBe('');
  });

  it('HUD 점수 문구: 콤보는 2 이상일 때만, 기록 없음은 "-"', () => {
    expect(hudText.best(null)).toBe('최고 -');
    expect(hudText.plateGain(45)).toBe('+45');
    expect(hudText.combo(1, 1)).toBeNull();
    expect(hudText.combo(3, 1.2)).toBe('콤보 ×1.2');
    expect(hudText.resultNewBest).toBe('최고 기록!');
  });

  it('튜토리얼 화살표 동작 문구와 표기: 버터(마가린 표기 없음)', () => {
    expect(tutorialArrowHints).toEqual({ margarine: '끌어서 바르기', batter: '끌어서 붓기', filling: '끌어서 넣기' });
    for (const s of tutorialStepsV2) expect(s.message).not.toContain('마가린');
  });

  it('금지어가 없다(dialogue-banned-words.txt 기준)', () => {
    const banned = readFileSync('harness/scripts/dialogue-banned-words.txt', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('!'));
    const texts = [...Object.values(fumedLines).flat(), ...Object.values(tasteLines).flatMap((p) => Object.values(p).flat()), ...tutorialStepsV2.map((s) => s.message)];
    for (const t of texts) for (const w of banned) expect(t.toLowerCase()).not.toContain(w.toLowerCase());
  });
});
