import type { TutorialStage, TutorialStepV2 } from '../contracts';

// 튜토리얼 안내문구 7개(단계별). 기준: docs/GDD.md §진행 튜토리얼, §콘텐츠
export const tutorialStepsV2: readonly TutorialStepV2[] = [
  { stage: 'margarine', message: '버터 통을 끌어 구멍 6개에 모두 발라요!' },
  { stage: 'batter', message: '반죽 주전자를 끌어 구멍마다 부어요!' },
  { stage: 'cook-wait', message: '반죽이 익을 때까지 잠깐 기다려요!' },
  { stage: 'filling', message: '트레이에서 문어를 끌어 구멍에 넣어요!' },
  { stage: 'roll-1', message: '구멍을 톡 눌러 첫 번째로 굴려요!' },
  { stage: 'roll-2', message: '한 번 더 눌러 동그랗게 굴려요!' },
  { stage: 'fune', message: '완성품을 끌어 아래 후네에 담아요!' },
];

/** 튜토리얼 화살표 옆 동작 문구(GDD §튜토리얼). 문구가 없는 단계는 화살표만 보인다. */
export const tutorialArrowHints: Readonly<Partial<Record<TutorialStage, string>>> = {
  margarine: '끌어서 바르기',
  batter: '끌어서 붓기',
  filling: '끌어서 넣기',
};
