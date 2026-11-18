// 튜토리얼 안내문구 9개(굽기 단계별). 기준: docs/GDD.md §튜토리얼, §콘텐츠
import type { TutorialStep, TutorialStepV2 } from '../contracts';

export const tutorialSteps: readonly TutorialStep[] = [
  { target: 'margarine', message: '철판 구멍에 마가린을 발라요!' },
  { target: 'batter', message: '반죽물을 부어 구멍을 채워요!' },
  { target: 'cook-1', message: '게이지가 알맞게 찼을 때 눌러요!' },
  { target: 'filling', message: '속재료 트레이에서 문어를 넣어요!' },
  { target: 'cook-2', message: '한 번 더, 알맞게 익었을 때 눌러요!' },
  { target: 'roll-1', message: '첫 번째 굴리기! 타이밍에 맞춰 눌러요!' },
  { target: 'roll-2', message: '두 번째 굴리기예요, 한 번 더!' },
  { target: 'roll-3', message: '마지막 굴리기! 동그랗게 만들어요!' },
  { target: 'done', message: '완성이에요! 손님께 내어 드려요!' },
];

// 새 흐름 안내문구 7개(단계별). 기준: docs/GDD.md §진행 튜토리얼, §콘텐츠
export const tutorialStepsV2: readonly TutorialStepV2[] = [
  { stage: 'margarine', message: '마가린 통을 끌어 구멍 6개에 모두 발라요!' },
  { stage: 'batter', message: '반죽 주전자를 끌어 구멍마다 부어요!' },
  { stage: 'cook-wait', message: '반죽이 익을 때까지 잠깐 기다려요!' },
  { stage: 'filling', message: '트레이에서 문어를 끌어 구멍에 넣어요!' },
  { stage: 'roll-1', message: '구멍을 톡 눌러 첫 번째로 굴려요!' },
  { stage: 'roll-2', message: '한 번 더 눌러 동그랗게 굴려요!' },
  { stage: 'fune', message: '완성품을 끌어 아래 후네에 담아요!' },
];
