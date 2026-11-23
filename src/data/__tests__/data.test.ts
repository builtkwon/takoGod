// GDD §콘텐츠 수량 대조: 대사 성격당 10(총 40), 리뷰 코멘트 성격당 별점 구간 5×3, 튜토리얼 안내 7, 맛보기 반응 40
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Personality, TasteKind, TutorialStage } from '../../contracts';
import { avoidLines, dialogues, fumedLines, groupLines, orderLines, orderResultLines, reportCard, rushText, vipLines, hudText, reviewComments, tasteLines, tutorialArrowHints, tutorialReviewComment, tutorialTapHint, tutorialStepsV2 } from '../index';

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

  it('v0.6.0 문구 수량: 주문 30·빼 주세요 10·결과 반응 16·신고 3·러시 2·단체 8·VIP 8', () => {
    const order = Object.values(orderLines).flatMap((byCount) => Object.values(byCount).flat());
    expect(order).toHaveLength(30);
    expect(Object.values(avoidLines).flat()).toHaveLength(10);
    expect(Object.values(orderResultLines).flatMap((byP) => Object.values(byP).flat())).toHaveLength(16);
    expect(reportCard.lines).toHaveLength(3);
    expect(rushText.notices).toHaveLength(2);
    expect(Object.values(groupLines).flat()).toHaveLength(8);
    expect(Object.values(vipLines).flat()).toHaveLength(8);
  });

  it('v0.6.0 문구는 비어 있지 않고 서로 다르며 말풍선 한 줄(28자 이내)에 들어간다', () => {
    const groups = [
      Object.values(orderLines).flatMap((byCount) => Object.values(byCount).flat()),
      Object.values(avoidLines).flat(),
      Object.values(orderResultLines).flatMap((byP) => Object.values(byP).flat()),
      Object.values(groupLines).flat(),
      Object.values(vipLines).flat(),
    ];
    for (const g of groups) {
      expect(new Set(g).size).toBe(g.length);
      for (const t of g) {
        expect(t.trim()).not.toBe('');
        expect(t.length).toBeLessThanOrEqual(28);
      }
    }
  });

  it('주문 대사에 사용자 예시 3개가 들어 있고 빼 주세요 대사는 "빼 주세요"를 말한다', () => {
    const order = Object.values(orderLines).flatMap((byCount) => Object.values(byCount).flat());
    for (const ex of ['3개는 매운 고추를 넣어주세요', '친구를 놀리기 위해 1개는 지우개를 넣어주세요', '저는 단 게 좋아요, 모두 마시멜로로 주세요']) expect(order).toContain(ex);
    for (const t of Object.values(avoidLines).flat()) expect(t).toContain('빼 주세요');
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
    expect(tutorialArrowHints).toEqual({ margarine: '끌어서 바르기', batter: '끌어서 붓기' }); // 속재료는 탭 방식이라 끌기 문구가 없다
    expect(tutorialTapHint).toBe('탭');
    for (const s of tutorialStepsV2) expect(s.message).not.toContain('마가린');
  });

  it('금지어가 없다(dialogue-banned-words.txt 기준)', () => {
    const banned = readFileSync('harness/scripts/dialogue-banned-words.txt', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#') && !l.startsWith('!'));
    const texts = [...Object.values(orderLines).flatMap((c) => Object.values(c).flat()), ...Object.values(avoidLines).flat(), ...Object.values(orderResultLines).flatMap((p) => Object.values(p).flat()), ...reportCard.lines, ...rushText.notices, ...Object.values(groupLines).flat(), ...Object.values(vipLines).flat(), ...Object.values(fumedLines).flat(), ...Object.values(tasteLines).flatMap((p) => Object.values(p).flat()), ...tutorialStepsV2.map((s) => s.message)];
    for (const t of texts) for (const w of banned) expect(t.toLowerCase()).not.toContain(w.toLowerCase());
  });
});
